import { Buffer } from 'buffer';
import { pbkdf2 } from '@react-native-module/pbkdf2';
import AesGcmCrypto from 'react-native-aes-gcm-crypto';
import { sha3_512 } from 'js-sha3';

const ENROLLMENT_URL = '/api/client-enrollment';
const WRAP_VERSION = 'pbkdf2-sha256-aes-gcm-v1';
const WRAP_ROUNDS = 210000;
const SYNC_KEY_PATTERN = /^ccsk_[A-Za-z0-9_-]{43}$/;

const base64UrlToBuffer = value => {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, 'base64');
};

export const encodeSyncEncryptionKey = rawKey => {
  const keyBuffer = Buffer.from(rawKey);
  if (keyBuffer.length !== 32) {
    throw new Error('Sync encryption key must be 32 bytes');
  }
  return `ccsk_${keyBuffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/[=]+$/, '')}`;
};

export const generateSyncEncryptionKey = async nativeBridgeModule => {
  const encodedKey = await nativeBridgeModule.secureRandomBase64Url(32);
  return `ccsk_${encodedKey}`;
};

const deriveWrappingKeyBase64 = (rawPassword, salt, rounds) =>
  new Promise((resolve, reject) => {
    if (!rawPassword) {
      reject(new Error('Account password is required'));
      return;
    }

    pbkdf2(
      Buffer.from(rawPassword, 'utf8'),
      salt,
      Number(rounds),
      32,
      'sha256',
      (error, key) => {
        if (error) {
          reject(error);
        } else {
          resolve(Buffer.from(key).toString('base64'));
        }
      },
    );
  });

export const wrapSyncEncryptionKey = async (
  rawPassword,
  syncEncryptionKey,
  nativeBridgeModule,
) => {
  if (!SYNC_KEY_PATTERN.test(String(syncEncryptionKey || '').trim())) {
    throw new Error('Invalid sync encryption key');
  }

  const salt = await nativeBridgeModule.secureRandomBase64Url(16);
  const wrappingKey = await deriveWrappingKeyBase64(
    rawPassword,
    base64UrlToBuffer(salt),
    WRAP_ROUNDS,
  );
  const encrypted = await AesGcmCrypto.encrypt(
    syncEncryptionKey,
    false,
    wrappingKey,
  );

  return {
    version: WRAP_VERSION,
    rounds: String(WRAP_ROUNDS),
    salt,
    nonce: encrypted.iv,
    ciphertext: encrypted.content,
    tag: encrypted.tag,
  };
};

export const unwrapSyncEncryptionKey = async (rawPassword, keyWrap) => {
  if (!keyWrap || keyWrap.version !== WRAP_VERSION) {
    throw new Error('Unsupported wrapped sync key version');
  }

  const wrappingKey = await deriveWrappingKeyBase64(
    rawPassword,
    base64UrlToBuffer(keyWrap.salt),
    Number(keyWrap.rounds),
  );
  const syncEncryptionKey = await AesGcmCrypto.decrypt(
    keyWrap.ciphertext,
    wrappingKey,
    keyWrap.nonce,
    keyWrap.tag,
    false,
  );

  if (!SYNC_KEY_PATTERN.test(String(syncEncryptionKey || '').trim())) {
    throw new Error('Invalid sync encryption key');
  }
  return syncEncryptionKey;
};

export const enrollClient = async (
  data,
  rawPassword,
  fetchTimeout,
  nativeBridgeModule,
) => {
  const serverUrl = String(data.server_url || '').replace(/\/+$/, '');
  const localSyncKey = await generateSyncEncryptionKey(nativeBridgeModule);
  const clientName = String(data.api_client_name || '').trim() || 'Android phone';
  const payload = {
    username: String(data.username || '').trim(),
    passwordHash: sha3_512(rawPassword).toLowerCase(),
    clientName,
    keyWrap: await wrapSyncEncryptionKey(
      rawPassword,
      localSyncKey,
      nativeBridgeModule,
    ),
  };

  const response = await fetchTimeout(serverUrl + ENROLLMENT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let detail = '';
    try {
      detail = await response.text();
    } catch (error) {
      detail = '';
    }
    throw new Error(
      `Client enrollment failed: ${response.status}${detail ? ` ${detail}` : ''}`,
    );
  }

  const responsePayload = await response.json();
  const syncEncryptionKey = await unwrapSyncEncryptionKey(
    rawPassword,
    responsePayload.keyWrap,
  );

  return {
    ...data,
    server_url: serverUrl,
    username: String(responsePayload.username || data.username || '').trim(),
    api_key: String(responsePayload.apiKey || '').trim(),
    api_client_id: String(responsePayload.clientId || '').trim(),
    api_client_name: String(responsePayload.clientName || clientName).trim(),
    cipher_enabled: 'true',
    sync_encryption_key: syncEncryptionKey,
    hashed_password: '',
    csrf_token: '',
  };
};

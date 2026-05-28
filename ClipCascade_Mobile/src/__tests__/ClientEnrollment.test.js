jest.mock('@react-native-module/pbkdf2', () => ({
  pbkdf2: jest.fn((password, salt, rounds, length, digest, callback) => {
    const { Buffer: MockBuffer } = require('buffer');
    callback(null, MockBuffer.alloc(length, 7));
  }),
}));

jest.mock('react-native-aes-gcm-crypto', () => ({
  encrypt: jest.fn(async plainText => ({
    iv: '00112233445566778899aabb',
    tag: 'ffeeddccbbaa99887766554433221100',
    content: require('buffer').Buffer.from(plainText, 'utf8').toString('base64'),
  })),
  decrypt: jest.fn(async ciphertext =>
    require('buffer').Buffer.from(ciphertext, 'base64').toString('utf8'),
  ),
}));

import { sha3_512 } from 'js-sha3';
import {
  enrollClient,
  generateSyncEncryptionKey,
  unwrapSyncEncryptionKey,
  wrapSyncEncryptionKey,
} from '../ClientEnrollment';

describe('ClientEnrollment', () => {
  const nativeBridge = {
    secureRandomBase64Url: jest.fn(async byteCount =>
      byteCount === 32
        ? 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
        : 'BBBBBBBBBBBBBBBBBBBBBB',
    ),
  };

  test('wraps and unwraps a sync encryption key without plaintext in the envelope', async () => {
    const syncKey = await generateSyncEncryptionKey(nativeBridge);

    const wrapped = await wrapSyncEncryptionKey(
      'account-password',
      syncKey,
      nativeBridge,
    );
    const unwrapped = await unwrapSyncEncryptionKey('account-password', wrapped);

    expect(unwrapped).toBe(syncKey);
    expect(wrapped.version).toBe('pbkdf2-sha256-aes-gcm-v1');
    expect(JSON.stringify(wrapped)).not.toContain(syncKey);
  });

  test('enrolls with credentials and stores returned existing API and sync keys', async () => {
    const remoteSyncKey = 'ccsk_CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC';
    const remoteWrap = await wrapSyncEncryptionKey(
      'account-password',
      remoteSyncKey,
      nativeBridge,
    );
    const fetchTimeout = jest.fn(async (url, init) => ({
      ok: true,
      status: 200,
      json: async () => ({
        username: 'admin',
        clientId: 'client-123',
        clientName: 'Android phone',
        apiKey: 'cck_device',
        scopes: ['sync'],
        syncKeyStatus: 'existing',
        keyWrap: remoteWrap,
      }),
    }));

    const nextData = await enrollClient(
      {
        server_url: 'https://clipcascade.example.test/',
        username: 'admin',
        api_client_name: 'Android phone',
      },
      'account-password',
      fetchTimeout,
      nativeBridge,
    );

    expect(nextData.api_key).toBe('cck_device');
    expect(nextData.api_client_id).toBe('client-123');
    expect(nextData.api_client_name).toBe('Android phone');
    expect(nextData.sync_encryption_key).toBe(remoteSyncKey);
    expect(nextData.cipher_enabled).toBe('true');
    expect(nextData.csrf_token).toBe('');
    expect(fetchTimeout).toHaveBeenCalledWith(
      'https://clipcascade.example.test/api/client-enrollment',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(String),
      }),
    );
    const postedPayload = JSON.parse(fetchTimeout.mock.calls[0][1].body);
    expect(postedPayload.passwordHash).toBe(sha3_512('account-password'));
    expect(JSON.stringify(postedPayload.keyWrap)).not.toContain(remoteSyncKey);
  });
});

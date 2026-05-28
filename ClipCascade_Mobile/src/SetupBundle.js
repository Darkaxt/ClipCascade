const SETUP_BUNDLE_TYPE = 'clipcascade-setup-v1';
const SYNC_KEY_PATTERN = /^ccsk_[A-Za-z0-9_-]{43}$/;

export const parseSetupBundle = rawBundle => {
  if (!rawBundle || String(rawBundle).trim() === '') {
    throw new Error('Setup bundle is empty');
  }

  let bundle;
  try {
    bundle = JSON.parse(String(rawBundle));
  } catch (error) {
    throw new Error('Setup bundle is not valid JSON');
  }

  if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle)) {
    throw new Error('Setup bundle must be a JSON object');
  }
  if (bundle.type !== SETUP_BUNDLE_TYPE) {
    throw new Error('Unsupported setup bundle type');
  }

  [
    'serverUrl',
    'username',
    'apiKey',
    'clientId',
    'clientName',
  ].forEach(key => {
    if (!String(bundle[key] || '').trim()) {
      throw new Error(`Setup bundle is missing ${key}`);
    }
  });

  if (bundle.encryptionMode === 'sync_key') {
    const syncKey = String(bundle.syncEncryptionKey || '').trim();
    if (!SYNC_KEY_PATTERN.test(syncKey)) {
      throw new Error('Setup bundle has an invalid sync encryption key');
    }
  }

  return bundle;
};

export const syncEncryptionKeyToBase64 = syncEncryptionKey => {
  const syncKey = String(syncEncryptionKey || '').trim();
  if (!SYNC_KEY_PATTERN.test(syncKey)) {
    throw new Error('Sync encryption key must be a valid ccsk_ key');
  }

  const base64Url = syncKey.slice(5);
  return `${base64Url.replace(/-/g, '+').replace(/_/g, '/')}=`;
};

export const applySetupBundleToData = (data, rawBundle) => {
  const bundle = parseSetupBundle(rawBundle);
  return {
    ...data,
    server_url: String(bundle.serverUrl).trim().replace(/\/+$/, ''),
    username: String(bundle.username).trim(),
    api_key: String(bundle.apiKey).trim(),
    api_client_id: String(bundle.clientId).trim(),
    api_client_name: String(bundle.clientName).trim(),
    cipher_enabled: String(bundle.cipherEnabled !== false),
    sync_encryption_key:
      bundle.encryptionMode === 'sync_key'
        ? String(bundle.syncEncryptionKey).trim()
        : '',
    hashed_password: '',
    csrf_token: '',
  };
};

const SYNC_KEY_PATTERN = /^ccsk_[A-Za-z0-9_-]{43}$/;

export const syncEncryptionKeyToBase64 = syncEncryptionKey => {
  const syncKey = String(syncEncryptionKey || '').trim();
  if (!SYNC_KEY_PATTERN.test(syncKey)) {
    throw new Error('Sync encryption key must be a valid ccsk_ key');
  }

  const base64Url = syncKey.slice(5);
  return `${base64Url.replace(/-/g, '+').replace(/_/g, '/')}=`;
};

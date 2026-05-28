import {
  applySetupBundleToData,
  parseSetupBundle,
  syncEncryptionKeyToBase64,
} from '../SetupBundle';

describe('SetupBundle', () => {
  const bundle = {
    type: 'clipcascade-setup-v1',
    serverUrl: 'https://aiostreams-egress.tail94fa2c.ts.net/',
    username: 'admin',
    apiKey: 'cck_device',
    clientId: 'client-123',
    clientName: 'Android phone',
    scopes: ['sync'],
    cipherEnabled: true,
    encryptionMode: 'sync_key',
    syncEncryptionKey: 'ccsk_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  };

  test('parses setup bundle JSON', () => {
    expect(parseSetupBundle(JSON.stringify(bundle))).toMatchObject({
      type: 'clipcascade-setup-v1',
      apiKey: 'cck_device',
      syncEncryptionKey: bundle.syncEncryptionKey,
    });
  });

  test('applies setup bundle to login data without a password', () => {
    const nextData = applySetupBundleToData(
      {
        server_url: 'http://localhost:8080',
        username: '',
        api_key: '',
        sync_encryption_key: '',
        hashed_password: 'legacy',
      },
      JSON.stringify(bundle),
    );

    expect(nextData).toMatchObject({
      server_url: 'https://aiostreams-egress.tail94fa2c.ts.net',
      username: 'admin',
      api_key: 'cck_device',
      api_client_id: 'client-123',
      api_client_name: 'Android phone',
      cipher_enabled: 'true',
      sync_encryption_key: bundle.syncEncryptionKey,
      hashed_password: '',
      csrf_token: '',
    });
  });

  test('converts ccsk key into base64 AES key material', () => {
    expect(syncEncryptionKeyToBase64(bundle.syncEncryptionKey)).toBe(
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
    );
  });

  test('rejects sync-key bundles without a valid sync key', () => {
    expect(() =>
      parseSetupBundle(
        JSON.stringify({
          ...bundle,
          syncEncryptionKey: 'ccsk_short',
        }),
      ),
    ).toThrow('invalid sync encryption key');
  });
});

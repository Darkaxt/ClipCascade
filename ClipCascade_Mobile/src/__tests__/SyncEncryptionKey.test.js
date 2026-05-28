import { syncEncryptionKeyToBase64 } from '../SyncEncryptionKey';

describe('SyncEncryptionKey', () => {
  test('converts ccsk key into base64 AES key material', () => {
    expect(
      syncEncryptionKeyToBase64(
        'ccsk_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      ),
    ).toBe('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=');
  });

  test('rejects malformed sync encryption keys', () => {
    expect(() => syncEncryptionKeyToBase64('ccsk_short')).toThrow(
      'valid ccsk_ key',
    );
  });
});

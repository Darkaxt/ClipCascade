import {
  createSafeKeyStore,
  deleteSafeKeyStoreValue,
  getSafeKeyStoreValue,
  setSafeKeyStoreValue,
} from '../SafeKeyStore';

describe('safe key store', () => {
  test('stores __proto__ as normal data without mutating Object.prototype', () => {
    const store = createSafeKeyStore();
    const channel = {};

    setSafeKeyStoreValue(store, '__proto__', channel);
    channel.polluted = true;

    expect(getSafeKeyStoreValue(store, '__proto__')).toBe(channel);
    expect({}.polluted).toBeUndefined();
  });

  test('does not return inherited values for missing keys', () => {
    const inheritedValues = {
      inheritedPeer: { readyState: 'open' },
    };
    const store = Object.create(inheritedValues);

    expect(getSafeKeyStoreValue(store, 'inheritedPeer')).toBeNull();
  });

  test('deletes stored values without touching prototypes', () => {
    const store = createSafeKeyStore();
    const peer = { close: jest.fn() };

    setSafeKeyStoreValue(store, 'peer-1', peer);
    deleteSafeKeyStoreValue(store, 'peer-1');

    expect(getSafeKeyStoreValue(store, 'peer-1')).toBeNull();
    expect(Object.getPrototypeOf(store)).toBeNull();
  });
});

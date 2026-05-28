const hasOwn = Object.prototype.hasOwnProperty;

export const createSafeKeyStore = () => Object.create(null);

export const getSafeKeyStoreValue = (store, key) => {
  if (!store || !hasOwn.call(store, key)) {
    return null;
  }
  return store[key];
};

export const setSafeKeyStoreValue = (store, key, value) => {
  store[key] = value;
  return value;
};

export const deleteSafeKeyStoreValue = (store, key) => {
  if (store) {
    delete store[key];
  }
};

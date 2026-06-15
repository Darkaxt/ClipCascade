export const CLIPBOARD_DUPLICATE_SUPPRESSION_MS = 5000;

export const createClipboardDuplicateSuppression = ({
  now = Date.now,
  timeoutMs = CLIPBOARD_DUPLICATE_SUPPRESSION_MS,
} = {}) => {
  let previousHash = '';
  let previousAt = 0;

  return {
    reset() {
      previousHash = '';
      previousAt = 0;
    },
    accept(contentHash) {
      const currentAt = now();
      const isSameHash = previousHash === contentHash;
      const isInsideSuppressionWindow =
        previousAt > 0 && currentAt - previousAt < timeoutMs;

      if (isSameHash && isInsideSuppressionWindow) {
        return false;
      }

      previousHash = contentHash;
      previousAt = currentAt;
      return true;
    },
  };
};

export const CLIPBOARD_ECHO_SUPPRESSION_MS = 5000;
export const CLIPBOARD_ECHO_SUPPRESSION_TYPE_KEY =
  'clipboardEchoSuppressionType';
export const CLIPBOARD_ECHO_SUPPRESSION_HASH_KEY =
  'clipboardEchoSuppressionHash';
export const CLIPBOARD_ECHO_SUPPRESSION_UNTIL_KEY =
  'clipboardEchoSuppressionUntil';

export const setClipboardEchoSuppression = async ({
  setValue,
  type,
  contentHash = '',
  now = Date.now(),
}) => {
  await setValue(CLIPBOARD_ECHO_SUPPRESSION_TYPE_KEY, type);
  await setValue(CLIPBOARD_ECHO_SUPPRESSION_HASH_KEY, contentHash);
  await setValue(
    CLIPBOARD_ECHO_SUPPRESSION_UNTIL_KEY,
    String(now + CLIPBOARD_ECHO_SUPPRESSION_MS),
  );
};

export const clearClipboardEchoSuppression = async ({ setValue }) => {
  await setValue(CLIPBOARD_ECHO_SUPPRESSION_TYPE_KEY, '');
  await setValue(CLIPBOARD_ECHO_SUPPRESSION_HASH_KEY, '');
  await setValue(CLIPBOARD_ECHO_SUPPRESSION_UNTIL_KEY, '');
};

export const createLocalImageEchoGuard = ({
  now = Date.now,
  timeoutMs = CLIPBOARD_ECHO_SUPPRESSION_MS,
} = {}) => {
  let suppressImageUntil = 0;

  return {
    arm() {
      suppressImageUntil = now() + timeoutMs;
    },
    clear() {
      suppressImageUntil = 0;
    },
    shouldSuppress(type) {
      if (type !== 'image') {
        return false;
      }

      if (!suppressImageUntil || now() > suppressImageUntil) {
        suppressImageUntil = 0;
        return false;
      }

      suppressImageUntil = 0;
      return true;
    },
  };
};

export const shouldSuppressClipboardEcho = async ({
  getValue,
  hashCB,
  type,
  content,
  now = Date.now(),
}) => {
  const suppressionUntil = Number(
    await getValue(CLIPBOARD_ECHO_SUPPRESSION_UNTIL_KEY),
  );
  if (!suppressionUntil || now > suppressionUntil) {
    return false;
  }

  const suppressionType = await getValue(CLIPBOARD_ECHO_SUPPRESSION_TYPE_KEY);
  if (suppressionType !== type) {
    return false;
  }

  if (type === 'image') {
    return true;
  }

  if (type === 'text') {
    const suppressionHash = await getValue(CLIPBOARD_ECHO_SUPPRESSION_HASH_KEY);
    return suppressionHash === (await hashCB(content));
  }

  return false;
};

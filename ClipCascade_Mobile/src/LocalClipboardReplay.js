import { sha3_256 } from 'js-sha3';

export const LOCAL_CLIPBOARD_REPLAY_HASH_KEY =
  'localClipboardReplayPendingHash';

const hashReplayText = content => sha3_256(String(content));

export const armLocalClipboardReplay = async ({ setValue, content }) => {
  await setValue(LOCAL_CLIPBOARD_REPLAY_HASH_KEY, hashReplayText(content));
};

export const clearLocalClipboardReplay = async ({ setValue }) => {
  await setValue(LOCAL_CLIPBOARD_REPLAY_HASH_KEY, '');
};

export const consumeLocalClipboardReplay = async ({
  getValue,
  setValue,
  type,
  content,
}) => {
  if (type !== 'text') {
    return false;
  }

  const pendingHash = await getValue(LOCAL_CLIPBOARD_REPLAY_HASH_KEY);
  if (!pendingHash) {
    return false;
  }

  await setValue(LOCAL_CLIPBOARD_REPLAY_HASH_KEY, '');
  return pendingHash === hashReplayText(content);
};

export const copyReplayTextLocally = async ({
  eventId,
  getReplayableText,
  setValue,
  setClipboardText,
}) => {
  const content = getReplayableText(eventId);
  if (content === undefined) {
    return { copied: false, reason: 'unavailable' };
  }

  await armLocalClipboardReplay({ setValue, content });
  try {
    setClipboardText(content);
    return { copied: true };
  } catch (error) {
    await clearLocalClipboardReplay({ setValue });
    return { copied: false, reason: 'write_failed' };
  }
};

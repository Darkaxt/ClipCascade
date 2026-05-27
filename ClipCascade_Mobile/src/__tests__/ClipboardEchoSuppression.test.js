import {
  clearClipboardEchoSuppression,
  setClipboardEchoSuppression,
  shouldSuppressClipboardEcho,
} from '../ClipboardEchoSuppression';

describe('clipboard echo suppression', () => {
  let storage;
  const setValue = async (key, value) => {
    storage[key] = value;
  };
  const getValue = async key => storage[key] || '';
  const hashCB = async value => `hash:${value}`;

  beforeEach(() => {
    storage = {};
  });

  test('suppresses the exact text clipboard value applied by the app', async () => {
    await setClipboardEchoSuppression({
      setValue,
      type: 'text',
      contentHash: 'hash:remote otp',
      now: 1000,
    });

    await expect(
      shouldSuppressClipboardEcho({
        getValue,
        hashCB,
        type: 'text',
        content: 'remote otp',
        now: 2000,
      }),
    ).resolves.toBe(true);

    await expect(
      shouldSuppressClipboardEcho({
        getValue,
        hashCB,
        type: 'text',
        content: 'different local copy',
        now: 2000,
      }),
    ).resolves.toBe(false);
  });

  test('suppresses image echo by type without hashing the image payload', async () => {
    const hashSpy = jest.fn(hashCB);
    await setClipboardEchoSuppression({
      setValue,
      type: 'image',
      contentHash: 'remote-image-hash',
      now: 1000,
    });

    await expect(
      shouldSuppressClipboardEcho({
        getValue,
        hashCB: hashSpy,
        type: 'image',
        content: 'large-image-path-or-payload',
        now: 2000,
      }),
    ).resolves.toBe(true);
    expect(hashSpy).not.toHaveBeenCalled();
  });

  test('does not suppress after the short echo window expires', async () => {
    await setClipboardEchoSuppression({
      setValue,
      type: 'text',
      contentHash: 'hash:remote otp',
      now: 1000,
    });

    await expect(
      shouldSuppressClipboardEcho({
        getValue,
        hashCB,
        type: 'text',
        content: 'remote otp',
        now: 7000,
      }),
    ).resolves.toBe(false);
  });

  test('clears stored suppression state', async () => {
    await setClipboardEchoSuppression({
      setValue,
      type: 'text',
      contentHash: 'hash:remote otp',
      now: 1000,
    });
    await clearClipboardEchoSuppression({ setValue });

    await expect(
      shouldSuppressClipboardEcho({
        getValue,
        hashCB,
        type: 'text',
        content: 'remote otp',
        now: 2000,
      }),
    ).resolves.toBe(false);
  });
});

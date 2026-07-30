import {
  armLocalClipboardReplay,
  copyReplayTextLocally,
  consumeLocalClipboardReplay,
} from '../LocalClipboardReplay';

const createStore = () => {
  const values = new Map();
  return {
    getValue: async key => values.get(key) || '',
    setValue: async (key, value) => values.set(key, value),
  };
};

describe('local clipboard replay guard', () => {
  test('suppresses exactly one matching text clipboard event', async () => {
    const store = createStore();
    await armLocalClipboardReplay({
      setValue: store.setValue,
      content: 'restore this text',
    });

    await expect(
      consumeLocalClipboardReplay({
        ...store,
        type: 'text',
        content: 'restore this text',
      }),
    ).resolves.toBe(true);
    await expect(
      consumeLocalClipboardReplay({
        ...store,
        type: 'text',
        content: 'restore this text',
      }),
    ).resolves.toBe(false);
  });

  test('does not suppress a different text value and consumes the guard', async () => {
    const store = createStore();
    await armLocalClipboardReplay({
      setValue: store.setValue,
      content: 'expected text',
    });

    await expect(
      consumeLocalClipboardReplay({
        ...store,
        type: 'text',
        content: 'different text',
      }),
    ).resolves.toBe(false);
    await expect(
      consumeLocalClipboardReplay({
        ...store,
        type: 'text',
        content: 'expected text',
      }),
    ).resolves.toBe(false);
  });

  test('ignores non-text events without consuming the text guard', async () => {
    const store = createStore();
    await armLocalClipboardReplay({
      setValue: store.setValue,
      content: 'expected text',
    });

    await expect(
      consumeLocalClipboardReplay({
        ...store,
        type: 'image',
        content: 'image payload',
      }),
    ).resolves.toBe(false);
    await expect(
      consumeLocalClipboardReplay({
        ...store,
        type: 'text',
        content: 'expected text',
      }),
    ).resolves.toBe(true);
  });

  test('copies a replayable event only after arming the guard', async () => {
    const calls = [];
    const store = createStore();

    await expect(
      copyReplayTextLocally({
        eventId: 'event-1',
        getReplayableText: id =>
          id === 'event-1' ? 'restored locally' : undefined,
        setValue: async (key, value) => {
          calls.push('guard');
          await store.setValue(key, value);
        },
        setClipboardText: text => calls.push(`clipboard:${text}`),
      }),
    ).resolves.toEqual({ copied: true });

    expect(calls).toEqual(['guard', 'clipboard:restored locally']);
  });

  test('does not touch the clipboard when replay text is unavailable', async () => {
    const setClipboardText = jest.fn();

    await expect(
      copyReplayTextLocally({
        eventId: 'evicted-event',
        getReplayableText: () => undefined,
        setValue: jest.fn(),
        setClipboardText,
      }),
    ).resolves.toEqual({ copied: false, reason: 'unavailable' });

    expect(setClipboardText).not.toHaveBeenCalled();
  });

  test('clears the guard when the clipboard write fails', async () => {
    const store = createStore();
    await expect(
      copyReplayTextLocally({
        eventId: 'event-1',
        getReplayableText: () => 'will fail',
        setValue: store.setValue,
        setClipboardText: () => {
          throw new Error('clipboard unavailable');
        },
      }),
    ).resolves.toEqual({ copied: false, reason: 'write_failed' });

    await expect(
      consumeLocalClipboardReplay({
        ...store,
        type: 'text',
        content: 'will fail',
      }),
    ).resolves.toBe(false);
  });
});

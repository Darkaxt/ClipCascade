import { createClipboardDuplicateSuppression } from '../ClipboardDuplicateSuppression';

describe('clipboard duplicate suppression', () => {
  test('suppresses immediate duplicate hashes', () => {
    const clock = { now: 1000 };
    const suppression = createClipboardDuplicateSuppression({
      now: () => clock.now,
    });

    expect(suppression.accept('hash:otp')).toBe(true);
    clock.now = 2000;
    expect(suppression.accept('hash:otp')).toBe(false);
  });

  test('allows the same hash after the suppression window expires', () => {
    const clock = { now: 1000 };
    const suppression = createClipboardDuplicateSuppression({
      now: () => clock.now,
    });

    expect(suppression.accept('hash:otp')).toBe(true);
    clock.now = 7000;
    expect(suppression.accept('hash:otp')).toBe(true);
  });

  test('allows a different hash inside the suppression window', () => {
    const clock = { now: 1000 };
    const suppression = createClipboardDuplicateSuppression({
      now: () => clock.now,
    });

    expect(suppression.accept('hash:otp')).toBe(true);
    clock.now = 2000;
    expect(suppression.accept('hash:other')).toBe(true);
  });
});

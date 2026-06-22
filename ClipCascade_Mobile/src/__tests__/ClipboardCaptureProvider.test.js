import {
  getClipboardCaptureStatusMessage,
  getClipboardCaptureUnavailableStatusMessage,
  getClipboardCaptureUnavailableMessage,
  isClipboardCaptureStatusMessageClearableOnRecovery,
  isClipboardCaptureUnavailableStatusMessage,
  resolveClipboardCaptureProvider,
} from '../ClipboardCaptureProvider';

describe('clipboard capture provider selection', () => {
  test('uses the legacy backend when Shizuku clipboard capture is disabled', () => {
    expect(
      resolveClipboardCaptureProvider({
        enableShizukuClipboardBackend: 'false',
        shizukuStatus: 'connected',
      }),
    ).toEqual({
      backend: 'legacy',
      shizukuStatus: 'disabled',
      automaticCaptureEnabled: true,
      shouldNotifyUnavailable: false,
    });
  });

  test('uses Shizuku only when strict Shizuku mode is enabled and connected', () => {
    expect(
      resolveClipboardCaptureProvider({
        enableShizukuClipboardBackend: 'true',
        shizukuStatus: 'connected',
      }),
    ).toEqual({
      backend: 'shizuku',
      shizukuStatus: 'connected',
      automaticCaptureEnabled: true,
      shouldNotifyUnavailable: false,
    });
  });

  test('pauses automatic outbound capture instead of falling back when Shizuku is down', () => {
    expect(
      resolveClipboardCaptureProvider({
        enableShizukuClipboardBackend: 'true',
        shizukuStatus: 'disconnected',
      }),
    ).toEqual({
      backend: 'paused',
      shizukuStatus: 'disconnected',
      automaticCaptureEnabled: false,
      shouldNotifyUnavailable: true,
    });
  });

  test('treats Shizuku permission approval as pending without denied notification', () => {
    expect(
      resolveClipboardCaptureProvider({
        enableShizukuClipboardBackend: 'true',
        shizukuStatus: 'permission_pending',
      }),
    ).toEqual({
      backend: 'paused',
      shizukuStatus: 'permission_pending',
      automaticCaptureEnabled: false,
      shouldNotifyUnavailable: false,
    });
    expect(getClipboardCaptureStatusMessage('permission_pending')).toBe(
      'Shizuku permission approval pending',
    );
    expect(getClipboardCaptureUnavailableStatusMessage('permission_pending')).toBe(
      '',
    );
  });

  test('normalizes unknown Shizuku status as disconnected strict mode', () => {
    expect(
      resolveClipboardCaptureProvider({
        enableShizukuClipboardBackend: 'true',
        shizukuStatus: undefined,
      }),
    ).toEqual({
      backend: 'paused',
      shizukuStatus: 'disconnected',
      automaticCaptureEnabled: false,
      shouldNotifyUnavailable: true,
    });
  });

  test('describes unavailable strict-mode states for UI and notifications', () => {
    expect(getClipboardCaptureUnavailableMessage('not_authorized')).toBe(
      'Shizuku permission denied',
    );
    expect(getClipboardCaptureUnavailableMessage('unsupported')).toBe(
      'Shizuku clipboard backend unsupported',
    );
    expect(getClipboardCaptureUnavailableMessage('disconnected')).toBe(
      'Shizuku disconnected',
    );
  });

  test('identifies Shizuku unavailable status banners as clearable on recovery', () => {
    expect(
      getClipboardCaptureUnavailableStatusMessage('not_authorized'),
    ).toBe('⚠️ Shizuku permission denied');
    expect(
      isClipboardCaptureUnavailableStatusMessage(
        '⚠️ Shizuku permission denied',
      ),
    ).toBe(true);
    expect(
      isClipboardCaptureUnavailableStatusMessage(
        '⚠️ Shizuku clipboard backend unsupported',
      ),
    ).toBe(true);
    expect(
      isClipboardCaptureUnavailableStatusMessage('❌ Outbound Error: failed'),
    ).toBe(false);
    expect(
      isClipboardCaptureUnavailableStatusMessage(
        '⚠️ Shizuku URI access unavailable',
      ),
    ).toBe(true);
  });

  test('identifies pending and unavailable Shizuku status banners as clearable on recovery', () => {
    expect(
      isClipboardCaptureStatusMessageClearableOnRecovery(
        'Shizuku permission approval pending',
      ),
    ).toBe(true);
    expect(
      isClipboardCaptureStatusMessageClearableOnRecovery(
        '⚠️ Shizuku permission denied',
      ),
    ).toBe(true);
    expect(
      isClipboardCaptureStatusMessageClearableOnRecovery('✅ Connected'),
    ).toBe(false);
    expect(
      isClipboardCaptureStatusMessageClearableOnRecovery(
        '⚠️ Shizuku URI access unavailable',
      ),
    ).toBe(true);
    expect(
      isClipboardCaptureStatusMessageClearableOnRecovery(
        '❌ Outbound Error: failed',
      ),
    ).toBe(false);
  });
});

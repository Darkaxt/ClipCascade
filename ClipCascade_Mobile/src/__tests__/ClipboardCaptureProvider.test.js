import {
  getClipboardCaptureUnavailableMessage,
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
});

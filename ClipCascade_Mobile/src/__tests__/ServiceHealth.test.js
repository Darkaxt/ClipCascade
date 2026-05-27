import {
  getStartupServiceState,
  resolveClipboardLimit,
  normalizeRuntimeSettings,
  shouldPersistStoppedStateAfterSessionValidation,
} from '../ServiceHealth';

describe('service health decisions', () => {
  test('does not persist a stop command after a missed startup heartbeat', () => {
    const state = getStartupServiceState('true', false);

    expect(state.wsIsRunningForUi).toBe('false');
    expect(state.shouldPersistWsIsRunning).toBe(false);
    expect(state.missedHeartbeat).toBe(true);
    expect(state.statusMessage).toContain('did not respond');
    expect(shouldPersistStoppedStateAfterSessionValidation(state)).toBe(false);
  });

  test('keeps a running service marked as running after a successful heartbeat', () => {
    const state = getStartupServiceState('true', true);

    expect(state.wsIsRunningForUi).toBe('true');
    expect(state.shouldPersistWsIsRunning).toBe(false);
    expect(state.missedHeartbeat).toBe(false);
    expect(state.statusMessage).toBe('');
    expect(shouldPersistStoppedStateAfterSessionValidation(state)).toBe(true);
  });
});

describe('runtime settings normalization', () => {
  test('uses the server max size when local limit is zero or invalid', () => {
    expect(resolveClipboardLimit('0', 268435456)).toBe(268435456);
    expect(resolveClipboardLimit('', 268435456)).toBe(268435456);
    expect(resolveClipboardLimit('not-a-number', 268435456)).toBe(268435456);
  });

  test('updates mutable service settings from async-storage values', () => {
    const current = {
      enable_shizuku_clipboard_backend: 'false',
      enable_image_sharing: 'true',
      enable_file_sharing: 'true',
      enable_websocket_status_notification: 'false',
      max_clipboard_size_local_limit_bytes: 1048576,
    };

    expect(
      normalizeRuntimeSettings(
        current,
        {
          enable_shizuku_clipboard_backend: 'true',
          enable_image_sharing: 'false',
          enable_file_sharing: 'true',
          enable_websocket_status_notification: 'true',
          max_clipboard_size_local_limit_bytes: '0',
        },
        268435456,
      ),
    ).toEqual({
      enable_shizuku_clipboard_backend: 'true',
      enable_image_sharing: 'false',
      enable_file_sharing: 'true',
      enable_websocket_status_notification: 'true',
      max_clipboard_size_local_limit_bytes: 268435456,
    });
  });
});

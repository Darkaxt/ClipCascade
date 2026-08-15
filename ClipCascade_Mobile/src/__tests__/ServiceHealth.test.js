import {
  getStartupServiceState,
  resolveClipboardLimit,
  normalizeRuntimeSettings,
  shouldAutoRecoverForegroundService,
  shouldPersistStoppedStateAfterSessionValidation,
  shouldRestartDisconnectedStomp,
} from '../ServiceHealth';

describe('service health decisions', () => {
  test('does not persist a stop command after a missed startup heartbeat', () => {
    const state = getStartupServiceState('true', false);

    expect(state.wsIsRunningForUi).toBe('false');
    expect(state.shouldPersistWsIsRunning).toBe(false);
    expect(state.missedHeartbeat).toBe(true);
    expect(state.statusMessage).toContain('did not respond');
    expect(shouldPersistStoppedStateAfterSessionValidation(state)).toBe(false);
    expect(shouldAutoRecoverForegroundService(state)).toBe(true);
  });

  test('keeps a running service marked as running after a successful heartbeat', () => {
    const state = getStartupServiceState('true', true);

    expect(state.wsIsRunningForUi).toBe('true');
    expect(state.shouldPersistWsIsRunning).toBe(false);
    expect(state.missedHeartbeat).toBe(false);
    expect(state.statusMessage).toBe('');
    expect(shouldPersistStoppedStateAfterSessionValidation(state)).toBe(true);
    expect(shouldAutoRecoverForegroundService(state)).toBe(false);
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

describe('STOMP connection recovery', () => {
  test('restarts an inactive disconnected client immediately', () => {
    expect(
      shouldRestartDisconnectedStomp({
        connected: false,
        active: false,
        disconnectedSince: 1000,
        lastRecoveryAt: 0,
        now: 1001,
        recoveryIntervalMs: 60000,
      }),
    ).toBe(true);
  });

  test('restarts a stalled active client after the recovery heartbeat', () => {
    expect(
      shouldRestartDisconnectedStomp({
        connected: false,
        active: true,
        disconnectedSince: 1000,
        lastRecoveryAt: 0,
        now: 61000,
        recoveryIntervalMs: 60000,
      }),
    ).toBe(true);
  });

  test('leaves connected and recently retrying clients alone', () => {
    const base = {
      disconnectedSince: 1000,
      lastRecoveryAt: 0,
      recoveryIntervalMs: 60000,
    };

    expect(
      shouldRestartDisconnectedStomp({
        ...base,
        connected: true,
        active: true,
        now: 61000,
      }),
    ).toBe(false);
    expect(
      shouldRestartDisconnectedStomp({
        ...base,
        connected: false,
        active: true,
        now: 60999,
      }),
    ).toBe(false);
  });

  test('spaces forced recovery attempts by the heartbeat interval', () => {
    expect(
      shouldRestartDisconnectedStomp({
        connected: false,
        active: true,
        disconnectedSince: 1000,
        lastRecoveryAt: 61000,
        now: 120999,
        recoveryIntervalMs: 60000,
      }),
    ).toBe(false);
  });
});

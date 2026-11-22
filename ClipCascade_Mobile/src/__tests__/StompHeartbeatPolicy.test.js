import {
  ACTIVE_STOMP_HEARTBEAT_MS,
  IDLE_STOMP_HEARTBEAT_MS,
  SCREEN_OFF_GRACE_MS,
  ACTIVE_STOMP_RECONNECT_DELAY_MS,
  ACTIVE_STOMP_RECOVERY_INTERVAL_MS,
  IDLE_STOMP_RETRY_MS,
  WAKE_RECONNECT_GRACE_MS,
  isStompScreenIdle,
  nextStompHeartbeat,
  shouldAnnounceConnectionLost,
  stompRetryPolicy,
  trackScreenOffSince,
} from '../StompHeartbeatPolicy';

describe('StompHeartbeatPolicy', () => {
  test('tracks the first screen-off instant and clears it on screen-on', () => {
    expect(trackScreenOffSince({ interactive: false, screenOffSince: null, now: 5 })).toBe(5);
    expect(trackScreenOffSince({ interactive: false, screenOffSince: 5, now: 9 })).toBe(5);
    expect(trackScreenOffSince({ interactive: true, screenOffSince: 5, now: 9 })).toBeNull();
  });

  test('keeps the active heartbeat while interactive or within the grace period', () => {
    const current = ACTIVE_STOMP_HEARTBEAT_MS;
    expect(nextStompHeartbeat({ interactive: true, screenOffSince: null, now: 0, current })).toBeNull();
    expect(
      nextStompHeartbeat({ interactive: false, screenOffSince: 0, now: SCREEN_OFF_GRACE_MS - 1, current }),
    ).toBeNull();
  });

  test('switches to the idle heartbeat after the screen-off grace period', () => {
    expect(
      nextStompHeartbeat({
        interactive: false,
        screenOffSince: 0,
        now: SCREEN_OFF_GRACE_MS,
        current: ACTIVE_STOMP_HEARTBEAT_MS,
      }),
    ).toBe(IDLE_STOMP_HEARTBEAT_MS);
    expect(
      nextStompHeartbeat({
        interactive: false,
        screenOffSince: 0,
        now: SCREEN_OFF_GRACE_MS * 10,
        current: IDLE_STOMP_HEARTBEAT_MS,
      }),
    ).toBeNull();
  });

  test('restores the active heartbeat as soon as the screen is on', () => {
    expect(
      nextStompHeartbeat({ interactive: true, screenOffSince: null, now: 0, current: IDLE_STOMP_HEARTBEAT_MS }),
    ).toBe(ACTIVE_STOMP_HEARTBEAT_MS);
  });

  test('treats the screen as idle only after the screen-off grace period', () => {
    expect(isStompScreenIdle({ interactive: true, screenOffSince: null, now: 0 })).toBe(false);
    expect(
      isStompScreenIdle({ interactive: false, screenOffSince: 0, now: SCREEN_OFF_GRACE_MS - 1 }),
    ).toBe(false);
    expect(
      isStompScreenIdle({ interactive: false, screenOffSince: 0, now: SCREEN_OFF_GRACE_MS }),
    ).toBe(true);
  });

  test('retries slowly while idle and at the normal pace otherwise', () => {
    expect(stompRetryPolicy({ idle: true })).toEqual({
      reconnectDelay: IDLE_STOMP_RETRY_MS,
      recoveryIntervalMs: IDLE_STOMP_RETRY_MS,
    });
    expect(stompRetryPolicy({ idle: false })).toEqual({
      reconnectDelay: ACTIVE_STOMP_RECONNECT_DELAY_MS,
      recoveryIntervalMs: ACTIVE_STOMP_RECOVERY_INTERVAL_MS,
    });
  });

  test('stays quiet about lost connections while idle and just after wake', () => {
    expect(shouldAnnounceConnectionLost({ idle: true, wokeAt: null, now: 0 })).toBe(false);
    expect(shouldAnnounceConnectionLost({ idle: false, wokeAt: 100, now: 100 })).toBe(false);
    expect(
      shouldAnnounceConnectionLost({ idle: false, wokeAt: 0, now: WAKE_RECONNECT_GRACE_MS }),
    ).toBe(true);
    expect(shouldAnnounceConnectionLost({ idle: false, wokeAt: null, now: 5 })).toBe(true);
  });
});

// STOMP heartbeats are negotiated once per CONNECT: the server sends at
// max(its own interval, the client's heartbeatIncoming). A 20 s heartbeat keeps
// a cellular radio (and, through a VPN such as Tailscale, its peer-session
// keepalive machinery) permanently awake, so ask for a long interval while the
// screen has been off for a while and restore the short one on screen-on.
export const ACTIVE_STOMP_HEARTBEAT_MS = 20000;
export const IDLE_STOMP_HEARTBEAT_MS = 300000;
export const SCREEN_OFF_GRACE_MS = 60000;

export const trackScreenOffSince = ({ interactive, screenOffSince, now }) => {
  if (interactive) {
    return null;
  }
  return screenOffSince ?? now;
};

export const isStompScreenIdle = ({ interactive, screenOffSince, now }) =>
  !interactive &&
  screenOffSince != null &&
  now - screenOffSince >= SCREEN_OFF_GRACE_MS;

// Returns the heartbeat to reconnect with, or null when the current one fits.
export const nextStompHeartbeat = ({ interactive, screenOffSince, now, current }) => {
  const idle = isStompScreenIdle({ interactive, screenOffSince, now });
  const desired = idle ? IDLE_STOMP_HEARTBEAT_MS : ACTIVE_STOMP_HEARTBEAT_MS;
  return desired === current ? null : desired;
};

// While the phone rests, the server can be unreachable for hours (for example
// when a VPN such as TailD pauses itself). Retrying every 10 s would keep
// waking the device for nothing, so retry slowly while idle and reconnect at
// once when the screen turns back on.
export const ACTIVE_STOMP_RECONNECT_DELAY_MS = 10000;
export const ACTIVE_STOMP_RECOVERY_INTERVAL_MS = 60000;
export const IDLE_STOMP_RETRY_MS = 300000;
export const WAKE_RECONNECT_GRACE_MS = 30000;

export const stompRetryPolicy = ({ idle }) =>
  idle
    ? { reconnectDelay: IDLE_STOMP_RETRY_MS, recoveryIntervalMs: IDLE_STOMP_RETRY_MS }
    : {
        reconnectDelay: ACTIVE_STOMP_RECONNECT_DELAY_MS,
        recoveryIntervalMs: ACTIVE_STOMP_RECOVERY_INTERVAL_MS,
      };

// A lost connection is expected while idle and during the first seconds after
// wake while the network (or VPN) comes back, so do not raise the notice then.
export const shouldAnnounceConnectionLost = ({ idle, wokeAt, now }) =>
  !idle && (wokeAt == null || now - wokeAt >= WAKE_RECONNECT_GRACE_MS);

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

// Returns the heartbeat to reconnect with, or null when the current one fits.
export const nextStompHeartbeat = ({ interactive, screenOffSince, now, current }) => {
  const idle =
    !interactive &&
    screenOffSince != null &&
    now - screenOffSince >= SCREEN_OFF_GRACE_MS;
  const desired = idle ? IDLE_STOMP_HEARTBEAT_MS : ACTIVE_STOMP_HEARTBEAT_MS;
  return desired === current ? null : desired;
};

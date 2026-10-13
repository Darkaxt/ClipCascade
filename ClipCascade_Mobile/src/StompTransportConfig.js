export const createStompTransportConfig = ({
  reconnectDelay,
  heartbeatIncoming,
}) => ({
  reconnectDelay,
  connectionTimeout: 5000,
  heartbeatIncoming,
  heartbeatOutgoing: 0,
  // A lost network may never deliver the native close event. Let stompjs
  // retire that socket immediately and own the next connection attempt.
  discardWebsocketOnCommFailure: true,
});

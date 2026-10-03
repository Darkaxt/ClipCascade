const { Client, ActivationState } = jest.requireActual('@stomp/stompjs');

test('force shutdown releases a real STOMP client without receipt or native close', async () => {
  const socket = {
    readyState: 1,
    send: jest.fn(),
    close: jest.fn(),
  };
  const connected = new Promise(resolve => {
    socket.onConnected = resolve;
  });
  const onWebSocketClose = jest.fn();
  const client = new Client({
    webSocketFactory: () => socket,
    connectionTimeout: 0,
    reconnectDelay: 0,
    heartbeatIncoming: 0,
    heartbeatOutgoing: 0,
    onConnect: socket.onConnected,
    onWebSocketClose,
  });
  client.activate();
  // Activation awaits before constructing the socket.
  await Promise.resolve();
  socket.onopen();
  socket.onmessage({ data: 'CONNECTED\nversion:1.2\n\n\0' });
  await connected;

  let gracefulFinished = false;
  const graceful = client.deactivate().then(() => {
    gracefulFinished = true;
  });
  await Promise.resolve();
  expect(
    socket.send.mock.calls.some(([frame]) => frame.startsWith('DISCONNECT')),
  ).toBe(true);
  expect(gracefulFinished).toBe(false);

  await client.deactivate({ force: true });
  await graceful;
  expect(client.state).toBe(ActivationState.INACTIVE);
  expect(client.connected).toBe(false);
  expect(socket.close).toHaveBeenCalledTimes(1);
  expect(onWebSocketClose).toHaveBeenCalledTimes(1);

  // The eventual native close must not invoke application callbacks twice.
  socket.onclose({ code: 1000 });
  expect(onWebSocketClose).toHaveBeenCalledTimes(1);
});

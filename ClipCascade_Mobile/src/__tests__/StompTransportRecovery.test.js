import { Client } from '@stomp/stompjs';
import { createStompTransportConfig } from '../StompTransportConfig';

describe('real stompjs network recovery', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('missed heartbeats discard a silent native socket and reconnect', async () => {
    const sockets = [];
    const client = new Client({
      ...createStompTransportConfig({ reconnectDelay: 1000, heartbeatIncoming: 1000 }),
      webSocketFactory: () => {
        const socket = { readyState: 1, send: jest.fn(), close: jest.fn() };
        sockets.push(socket);
        return socket;
      },
    });
    client.activate();
    await Promise.resolve();
    sockets[0].onopen();
    sockets[0].onmessage({ data: 'CONNECTED\nversion:1.2\nheart-beat:1000,0\n\n\0' });
    expect(client.connected).toBe(true);
    await jest.advanceTimersByTimeAsync(3000);
    expect(sockets[0].close).toHaveBeenCalledTimes(1);
    expect(client.connected).toBe(false);
    await jest.advanceTimersByTimeAsync(1000);
    expect(sockets).toHaveLength(2);
    sockets[1].onopen();
    sockets[1].onmessage({ data: 'CONNECTED\nversion:1.2\nheart-beat:1000,0\n\n\0' });
    client.publish({ destination: '/app/cliptext', body: 'recovered' });
    expect(sockets[1].send.mock.calls.some(([data]) => data.includes('recovered'))).toBe(true);
    // Late closure of the old socket cannot disconnect the replacement.
    sockets[0].onclose({ code: 1006 });
    expect(client.connected).toBe(true);
    await client.deactivate({ force: true });
  });

  test('repeated DNS-like failures retry and a silent handshake cannot trap recovery', async () => {
    const sockets = [];
    const client = new Client({
      ...createStompTransportConfig({ reconnectDelay: 1000, heartbeatIncoming: 1000 }),
      webSocketFactory: () => {
        const socket = { readyState: 0, send: jest.fn(), close: jest.fn() };
        sockets.push(socket);
        return socket;
      },
    });
    client.activate();
    await Promise.resolve();
    for (let index = 0; index < 2; index++) {
      sockets[index].onerror({ message: 'DNS unavailable' });
      sockets[index].onclose({ code: 1006 });
      await jest.advanceTimersByTimeAsync(1000);
    }
    // The third attempt has neither open nor close callbacks.
    await jest.advanceTimersByTimeAsync(6000);
    expect(sockets[2].close).toHaveBeenCalledTimes(1);
    expect(sockets).toHaveLength(4);
    sockets[3].readyState = 1;
    sockets[3].onopen();
    sockets[3].onmessage({ data: 'CONNECTED\nversion:1.2\nheart-beat:0,0\n\n\0' });
    expect(client.connected).toBe(true);
    await client.deactivate({ force: true });
  });
});

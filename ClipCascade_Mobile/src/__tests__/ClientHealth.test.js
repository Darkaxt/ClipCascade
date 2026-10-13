import { attachClientHealth, reportClipboardDetected } from '../ClientHealth';

test('control probes produce typed ACKs without clipboard processing', () => {
  const client = { connected: true, subscribe: jest.fn(), publish: jest.fn() };
  attachClientHealth(client, '3.2.0.29');
  expect(client.subscribe.mock.calls[0][0]).toBe('/user/queue/client-health');
  const callback = client.subscribe.mock.calls[0][1];
  client.publish.mockClear();
  callback({ body: JSON.stringify({ protocol: 1, kind: 'probe', probeId: 'abc-123' }) });
  expect(JSON.parse(client.publish.mock.calls[0][0].body)).toEqual({
    protocol: 1, kind: 'ack', ackType: 'client_alive', probeId: 'abc-123',
  });
  client.publish.mockClear();
  callback({ body: '{' });
  callback({ body: JSON.stringify({ protocol: 2, kind: 'probe', probeId: 'abc' }) });
  expect(client.publish).not.toHaveBeenCalled();
});

test('capture ACK contains metadata only, is not queued and cannot break capture', () => {
  const client = { connected: true, publish: jest.fn() };
  reportClipboardDetected(client, 'image');
  expect(JSON.parse(client.publish.mock.calls[0][0].body)).toEqual({
    protocol: 1, kind: 'ack', ackType: 'clipboard_detected', clipboardType: 'image',
  });
  client.publish.mockClear();
  client.connected = false;
  reportClipboardDetected(client, 'text');
  expect(client.publish).not.toHaveBeenCalled();
  client.connected = true;
  client.publish.mockImplementation(() => { throw new Error('closed'); });
  expect(() => reportClipboardDetected(client, 'files')).not.toThrow();
});

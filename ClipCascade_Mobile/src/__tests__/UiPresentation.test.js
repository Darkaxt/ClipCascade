import {
  filterClipboardEvents,
  buildHealthSummary,
  eventTone,
} from '../UiPresentation';

test('search and attention filtering preserve real event outcomes', () => {
  const events = [
    { id: 'a', type: 'text', status: 'sent', preview: 'Project notes' },
    {
      id: 'b',
      type: 'image',
      status: 'error',
      preview: 'Image',
      metadataText: 'Clipboard busy',
    },
    { id: 'c', type: 'text', status: 'applied', preview: 'Meeting notes' },
  ];
  expect(filterClipboardEvents(events, 'PROJECT')).toEqual([events[0]]);
  expect(filterClipboardEvents(events, '', 'Needs attention')).toEqual(
    events.slice(0, 2),
  );
  expect(filterClipboardEvents(events, '', 'Text')).toEqual([
    events[0],
    events[2],
  ]);
  expect(filterClipboardEvents(events, 'busy')).toEqual([events[1]]);
  expect(events[0].status).toBe('sent');
  expect(eventTone('Sent')).toBe('pending');
  expect(eventTone('Delivered')).toBe('good');
  expect(eventTone('Available')).toBe('muted');
});

test('health separates service, capture, transport and encryption', () => {
  const summary = buildHealthSummary({
    running: true,
    connected: true,
    captureBackend: 'paused',
    shizukuStatus: 'not_authorized',
    cipherEnabled: 'true',
  });
  expect(summary.connection.label).toBe('Connected');
  expect(summary.capture.label).toBe('Shizuku permission denied');
  expect(summary.capture.tone).toBe('error');
  expect(summary.encryption.label).toBe('Enabled');
  const stopped = buildHealthSummary({
    running: false,
    connected: true,
    captureBackend: 'shizuku',
    shizukuStatus: 'connected',
  });
  expect(stopped.capture.label).toBe('Paused');
  expect(stopped.connection.label).toBe('Paused');
  const unknown = buildHealthSummary({ running: true, connected: false });
  expect(unknown.capture.label).toBe('Not reported');
  expect(unknown.connection.label).toBe('Not connected');
});

test('authorized capture is not proof of connection or delivery', () => {
  const summary = buildHealthSummary({
    running: true,
    connected: false,
    captureBackend: 'shizuku',
    shizukuStatus: 'connected',
    cipherEnabled: 'false',
  });
  expect(summary.capture.label).toBe('Listening');
  expect(summary.connection.label).toBe('Not connected');
  expect(summary.encryption.label).toBe('Off');
  expect(summary).not.toHaveProperty('delivered');
});

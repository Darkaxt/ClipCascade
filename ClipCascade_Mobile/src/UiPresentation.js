import { getClipboardCaptureStatusMessage } from './ClipboardCaptureProvider';

export const UI_COLORS = {
  background: '#1f1e1e',
  surface: '#252424',
  raised: '#2e2d2d',
  text: '#f9f7f6',
  muted: '#b9b7b6',
  line: '#41403f',
  accent: '#72d6e5',
  selection: '#253a3e',
  good: '#9bdfb0',
  pending: '#f1cc79',
  error: '#ffaaa5',
  buttonInk: '#102f34',
  field: '#191919',
};

export const eventTone = status => {
  const value = String(status || '').toLowerCase();
  if (['applied', 'delivered'].includes(value)) {
    return 'good';
  }
  if (value === 'sent') {
    return 'pending';
  }
  if (['error', 'rejected', 'failed'].includes(value)) {
    return 'error';
  }
  return 'muted';
};

export const filterClipboardEvents = (events, query = '', mode = 'All') => {
  const search = query.trim().toLowerCase();
  return events.filter(
    event =>
      (mode !== 'Text' || event.type === 'text') &&
      (mode !== 'Needs attention' ||
        ['sent', 'error', 'rejected', 'failed'].includes(
          String(event.status).toLowerCase(),
        )) &&
      (!search ||
        [
          event.preview,
          event.metadataText,
          event.status,
          event.direction,
          event.type,
        ]
          .join(' ')
          .toLowerCase()
          .includes(search)),
  );
};

export const buildHealthSummary = ({
  running,
  connected,
  captureBackend,
  shizukuStatus,
  cipherEnabled,
}) => {
  let capture = { label: 'Not reported', tone: 'muted' };
  if (!running) {
    capture = { label: 'Paused', tone: 'muted' };
  } else if (captureBackend === 'shizuku' && shizukuStatus === 'connected') {
    capture = { label: 'Listening', tone: 'good' };
  } else if (captureBackend === 'legacy') {
    capture = { label: 'System backend', tone: 'muted' };
  } else if (shizukuStatus && shizukuStatus !== 'connected') {
    capture = {
      label:
        getClipboardCaptureStatusMessage(shizukuStatus).replace(
          /^[^A-Za-z]+/,
          '',
        ) || 'Capture paused',
      tone: ['startup_pending', 'permission_pending'].includes(shizukuStatus)
        ? 'pending'
        : 'error',
    };
  }
  return {
    service: {
      label: running ? 'Running' : 'Stopped',
      tone: running ? 'good' : 'muted',
    },
    capture,
    connection: {
      label: !running ? 'Paused' : connected ? 'Connected' : 'Not connected',
      tone: !running ? 'muted' : connected ? 'good' : 'pending',
    },
    encryption: {
      label: cipherEnabled === 'true' ? 'Enabled' : 'Off',
      tone: cipherEnabled === 'true' ? 'good' : 'muted',
    },
  };
};

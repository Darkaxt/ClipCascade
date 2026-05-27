export const CLIPBOARD_EVENT_LOG_LIMIT = 50;
const TEXT_PREVIEW_LIMIT = 48;

let events = [];
let listeners = new Set();

const now = () => Date.now();

export const formatBytes = value => {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) {
    return '';
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KiB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
};

const normalizeText = content => String(content ?? '').replace(/\s+/g, ' ').trim();

const truncateText = text => {
  if (text.length <= TEXT_PREVIEW_LIMIT) {
    return text;
  }

  return `${text.slice(0, TEXT_PREVIEW_LIMIT)}...`;
};

const buildFilesPreview = metadata => {
  const fileNames = Array.isArray(metadata?.fileNames) ? metadata.fileNames : [];
  const fileCount =
    Number.isFinite(Number(metadata?.fileCount)) && Number(metadata.fileCount) > 0
      ? Number(metadata.fileCount)
      : fileNames.length;

  if (fileNames.length > 0) {
    const shownNames = fileNames.slice(0, 3).join(', ');
    const suffix = fileNames.length > 3 ? ', ...' : '';
    return `${fileCount} ${fileCount === 1 ? 'file' : 'files'}: ${shownNames}${suffix}`;
  }

  return `${fileCount || 1} ${fileCount === 1 ? 'file' : 'files'}`;
};

export const buildClipboardEventPreview = ({ type, content, metadata = {} }) => {
  if (type === 'image') {
    return 'Image';
  }

  if (type === 'files') {
    return buildFilesPreview(metadata);
  }

  const preview = truncateText(normalizeText(content));
  return preview || 'Text';
};

const buildMetadataText = (type, metadata = {}) => {
  if (metadata.statusDetail) {
    return metadata.statusDetail;
  }

  if (type === 'image' || type === 'files') {
    return formatBytes(metadata.sizeBytes);
  }

  return '';
};

const notifyListeners = () => {
  const snapshot = getClipboardEvents();
  listeners.forEach(listener => listener(snapshot));
};

const toPublicEvent = event => {
  const { operationKey, ...publicEvent } = event;
  return publicEvent;
};

export const appendClipboardEvent = eventInput => {
  const event = {
    id:
      eventInput.id ||
      `${now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: eventInput.timestamp || now(),
    direction: eventInput.direction || 'system',
    type: eventInput.type || 'text',
    status: eventInput.status || 'Detected',
    preview: buildClipboardEventPreview(eventInput),
    metadataText: buildMetadataText(eventInput.type, eventInput.metadata),
    operationKey: eventInput.operationKey,
  };

  if (event.operationKey) {
    const existingIndex = events.findIndex(
      existingEvent => existingEvent.operationKey === event.operationKey,
    );

    if (existingIndex !== -1) {
      const existingEvent = events[existingIndex];
      const updatedEvent = {
        ...existingEvent,
        ...event,
        id: existingEvent.id,
      };
      events = [
        updatedEvent,
        ...events.filter((_, index) => index !== existingIndex),
      ].slice(0, CLIPBOARD_EVENT_LOG_LIMIT);
      notifyListeners();
      return toPublicEvent(updatedEvent);
    }
  }

  events = [event, ...events].slice(0, CLIPBOARD_EVENT_LOG_LIMIT);
  notifyListeners();
  return toPublicEvent(event);
};

export const getClipboardEvents = () =>
  events.map(event => ({ ...toPublicEvent(event) }));

export const clearClipboardEvents = () => {
  events = [];
  notifyListeners();
};

export const subscribeClipboardEvents = listener => {
  listeners.add(listener);
  listener(getClipboardEvents());
  return () => {
    listeners.delete(listener);
  };
};

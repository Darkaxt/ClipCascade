export const CLIPBOARD_EVENT_LOG_LIMIT = 50;
export const CLIPBOARD_REPLAY_CACHE_LIMIT_BYTES = 8 * 1024 * 1024;
const TEXT_PREVIEW_LIMIT = 48;

let events = [];
let listeners = new Set();
let replayTextByEventId = new Map();
let replayTextBytes = 0;

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

const utf8ByteLength = value => {
  let byteLength = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint <= 0x7f) {
      byteLength += 1;
    } else if (codePoint <= 0x7ff) {
      byteLength += 2;
    } else if (codePoint <= 0xffff) {
      byteLength += 3;
    } else {
      byteLength += 4;
    }
  }
  return byteLength;
};

const removeReplayText = eventId => {
  const cached = replayTextByEventId.get(eventId);
  if (!cached) {
    return;
  }

  replayTextBytes -= cached.sizeBytes;
  replayTextByEventId.delete(eventId);
};

const storeReplayText = (eventId, type, content) => {
  removeReplayText(eventId);
  if (type !== 'text' || content === undefined || content === null) {
    return;
  }

  const text = String(content);
  const sizeBytes = utf8ByteLength(text);
  if (sizeBytes > CLIPBOARD_REPLAY_CACHE_LIMIT_BYTES) {
    return;
  }

  replayTextByEventId.set(eventId, { text, sizeBytes });
  replayTextBytes += sizeBytes;

  while (replayTextBytes > CLIPBOARD_REPLAY_CACHE_LIMIT_BYTES) {
    const oldestEventId = replayTextByEventId.keys().next().value;
    removeReplayText(oldestEventId);
  }
};

const pruneReplayText = () => {
  const retainedEventIds = new Set(events.map(event => event.id));
  for (const eventId of replayTextByEventId.keys()) {
    if (!retainedEventIds.has(eventId)) {
      removeReplayText(eventId);
    }
  }
};

const toPublicEvent = event => {
  const { operationKey, ...publicEvent } = event;
  return {
    ...publicEvent,
    replayable: replayTextByEventId.has(event.id),
  };
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
      storeReplayText(updatedEvent.id, eventInput.type, eventInput.content);
      pruneReplayText();
      notifyListeners();
      return toPublicEvent(updatedEvent);
    }
  }

  events = [event, ...events].slice(0, CLIPBOARD_EVENT_LOG_LIMIT);
  storeReplayText(event.id, eventInput.type, eventInput.content);
  pruneReplayText();
  notifyListeners();
  return toPublicEvent(event);
};

export const getClipboardEvents = () =>
  events.map(event => ({ ...toPublicEvent(event) }));

export const getReplayableText = eventId =>
  replayTextByEventId.get(eventId)?.text;

export const clearClipboardEvents = () => {
  events = [];
  replayTextByEventId = new Map();
  replayTextBytes = 0;
  notifyListeners();
};

export const subscribeClipboardEvents = listener => {
  listeners.add(listener);
  listener(getClipboardEvents());
  return () => {
    listeners.delete(listener);
  };
};

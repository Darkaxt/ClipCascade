import {
  appendClipboardEvent,
  clearClipboardEvents,
  CLIPBOARD_EVENT_LOG_LIMIT,
  getClipboardEvents,
} from '../ClipboardEventLog';

describe('clipboard activity event log', () => {
  beforeEach(() => {
    clearClipboardEvents();
  });

  test('keeps only the newest 50 events in newest-first order', () => {
    for (let i = 0; i < CLIPBOARD_EVENT_LOG_LIMIT + 5; i++) {
      appendClipboardEvent({
        direction: 'outbound',
        type: 'text',
        status: 'Detected',
        content: `item ${i}`,
      });
    }

    const events = getClipboardEvents();

    expect(events).toHaveLength(CLIPBOARD_EVENT_LOG_LIMIT);
    expect(events[0].preview).toBe('item 54');
    expect(events[CLIPBOARD_EVENT_LOG_LIMIT - 1].preview).toBe('item 5');
  });

  test('stores only truncated normalized previews for text content', () => {
    const event = appendClipboardEvent({
      direction: 'outbound',
      type: 'text',
      status: 'Sent',
      content:
        'secret-token-start      copied text with too many characters and unique-sensitive-tail',
    });

    expect(event.preview).toBe(
      'secret-token-start copied text with too many cha...',
    );
    expect(event).not.toHaveProperty('content');
    expect(JSON.stringify(event)).not.toContain('unique-sensitive-tail');
  });

  test('stores image and file metadata without raw payloads', () => {
    const image = appendClipboardEvent({
      direction: 'inbound',
      type: 'image',
      status: 'Applied',
      content: 'raw-image-payload-that-should-not-be-kept',
      metadata: { sizeBytes: 1536 },
    });
    const files = appendClipboardEvent({
      direction: 'outbound',
      type: 'files',
      status: 'Sent',
      content: 'raw-files-payload-that-should-not-be-kept',
      metadata: { fileNames: ['a.txt', 'b.png'] },
    });

    expect(image.preview).toBe('Image');
    expect(image.metadataText).toBe('1.5 KiB');
    expect(files.preview).toBe('2 files: a.txt, b.png');
    expect(JSON.stringify(getClipboardEvents())).not.toContain(
      'raw-image-payload-that-should-not-be-kept',
    );
    expect(JSON.stringify(getClipboardEvents())).not.toContain(
      'raw-files-payload-that-should-not-be-kept',
    );
  });

  test('coalesces lifecycle updates for the same clipboard operation', () => {
    appendClipboardEvent({
      direction: 'inbound',
      type: 'text',
      status: 'Received',
      content: 'single copied value',
      operationKey: 'inbound:text:abc123',
    });

    const updated = appendClipboardEvent({
      direction: 'inbound',
      type: 'text',
      status: 'Applied',
      content: 'single copied value',
      operationKey: 'inbound:text:abc123',
    });

    const events = getClipboardEvents();

    expect(events).toHaveLength(1);
    expect(events[0].status).toBe('Applied');
    expect(events[0].preview).toBe('single copied value');
    expect(updated).not.toHaveProperty('operationKey');
    expect(JSON.stringify(events)).not.toContain('abc123');
  });
});

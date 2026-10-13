const DESTINATION = '/app/client-health';

function publish(client, message) {
  if (!client?.connected) {
    return;
  }
  try {
    client.publish({
      destination: DESTINATION,
      body: JSON.stringify({ protocol: 1, ...message }),
    });
  } catch {
    // A control-channel failure must not interrupt clipboard processing.
  }
}

export function attachClientHealth(client, version) {
  client.subscribe('/user/queue/client-health', frame => {
    try {
      const message = JSON.parse(frame.body);
      if (
        message?.protocol === 1 && message.kind === 'probe' &&
        typeof message.probeId === 'string' &&
        /^[A-Za-z0-9-]{1,64}$/.test(message.probeId)
      ) {
        publish(client, { kind: 'ack', ackType: 'client_alive', probeId: message.probeId });
      }
    } catch {
      // Unknown or malformed control messages are ignored.
    }
  });
  publish(client, { kind: 'hello', platform: 'android', version: version || 'unknown' });
}

export function reportClipboardDetected(client, clipboardType) {
  if (['text', 'image', 'files'].includes(clipboardType)) {
    publish(client, { kind: 'ack', ackType: 'clipboard_detected', clipboardType });
  }
}

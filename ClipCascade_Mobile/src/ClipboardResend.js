let currentSender;
const listeners = new Set();

export const isClipboardResendAvailable = () =>
  Boolean(currentSender?.isConnected());

export const notifyClipboardResendState = () => {
  listeners.forEach(listener => listener(isClipboardResendAvailable()));
};

export const subscribeClipboardResendState = listener => {
  listeners.add(listener);
  listener(isClipboardResendAvailable());
  return () => listeners.delete(listener);
};

export const registerClipboardResender = sender => {
  currentSender = sender;
  notifyClipboardResendState();
  return () => {
    if (currentSender === sender) {
      currentSender = undefined;
      notifyClipboardResendState();
    }
  };
};

export const resendClipboardText = async (eventId, getText) => {
  const content = getText(eventId);
  if (content === undefined) {
    return 'unavailable';
  }
  const sender = currentSender;
  if (!sender?.isConnected()) {
    return 'disconnected';
  }
  try {
    return await sender.send(content, 'text', { manualResend: true }) ? 'sent' : 'failed';
  } catch {
    return 'failed';
  }
};

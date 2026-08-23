export const SHIZUKU_STATUS = {
  DISABLED: 'disabled',
  STARTUP_PENDING: 'startup_pending',
  PERMISSION_PENDING: 'permission_pending',
  NOT_INSTALLED: 'not_installed',
  NOT_AUTHORIZED: 'not_authorized',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  UNSUPPORTED: 'unsupported',
};

export const SHIZUKU_BOOT_GRACE_HEALTH_CHECKS = 30;

export const CLIPBOARD_CAPTURE_BACKEND = {
  LEGACY: 'legacy',
  SHIZUKU: 'shizuku',
  PAUSED: 'paused',
};

export const SHIZUKU_URI_ACCESS_UNAVAILABLE_STATUS_MESSAGE =
  '⚠️ Shizuku URI access unavailable';

const validShizukuStatuses = new Set(Object.values(SHIZUKU_STATUS));

const normalizeShizukuStatus = status =>
  validShizukuStatuses.has(status) ? status : SHIZUKU_STATUS.DISCONNECTED;

export const resolveShizukuStartupStatus = ({
  nativeStatus,
  bootGraceChecksRemaining,
}) => {
  const normalizedStatus = normalizeShizukuStatus(nativeStatus);
  if (
    normalizedStatus === SHIZUKU_STATUS.DISCONNECTED &&
    bootGraceChecksRemaining > 0
  ) {
    return SHIZUKU_STATUS.STARTUP_PENDING;
  }

  return normalizedStatus;
};

export const resolveClipboardCaptureProvider = ({
  enableShizukuClipboardBackend,
  shizukuStatus,
}) => {
  if (enableShizukuClipboardBackend !== 'true') {
    return {
      backend: CLIPBOARD_CAPTURE_BACKEND.LEGACY,
      shizukuStatus: SHIZUKU_STATUS.DISABLED,
      automaticCaptureEnabled: true,
      shouldNotifyUnavailable: false,
    };
  }

  const normalizedStatus = normalizeShizukuStatus(shizukuStatus);

  if (normalizedStatus === SHIZUKU_STATUS.CONNECTED) {
    return {
      backend: CLIPBOARD_CAPTURE_BACKEND.SHIZUKU,
      shizukuStatus: SHIZUKU_STATUS.CONNECTED,
      automaticCaptureEnabled: true,
      shouldNotifyUnavailable: false,
    };
  }

  if (
    normalizedStatus === SHIZUKU_STATUS.STARTUP_PENDING ||
    normalizedStatus === SHIZUKU_STATUS.PERMISSION_PENDING
  ) {
    return {
      backend: CLIPBOARD_CAPTURE_BACKEND.PAUSED,
      shizukuStatus: normalizedStatus,
      automaticCaptureEnabled: false,
      shouldNotifyUnavailable: false,
    };
  }

  return {
    backend: CLIPBOARD_CAPTURE_BACKEND.PAUSED,
    shizukuStatus: normalizedStatus,
    automaticCaptureEnabled: false,
    shouldNotifyUnavailable: true,
  };
};

export const shouldRetryPausedShizukuCapture = ({
  pauseStatus,
  nativeStatus,
}) =>
  normalizeShizukuStatus(pauseStatus) !== SHIZUKU_STATUS.UNSUPPORTED &&
  normalizeShizukuStatus(nativeStatus) === SHIZUKU_STATUS.CONNECTED;

export const getClipboardCaptureUnavailableMessage = status => {
  switch (normalizeShizukuStatus(status)) {
    case SHIZUKU_STATUS.STARTUP_PENDING:
    case SHIZUKU_STATUS.PERMISSION_PENDING:
      return '';
    case SHIZUKU_STATUS.NOT_INSTALLED:
      return 'Shizuku not installed or not running';
    case SHIZUKU_STATUS.NOT_AUTHORIZED:
      return 'Shizuku permission denied';
    case SHIZUKU_STATUS.UNSUPPORTED:
      return 'Shizuku clipboard backend unsupported';
    case SHIZUKU_STATUS.CONNECTED:
      return '';
    case SHIZUKU_STATUS.DISABLED:
      return 'Shizuku clipboard backend disabled';
    case SHIZUKU_STATUS.DISCONNECTED:
    default:
      return 'Shizuku disconnected';
  }
};

export const getClipboardCaptureStatusMessage = status => {
  const normalizedStatus = normalizeShizukuStatus(status);
  if (normalizedStatus === SHIZUKU_STATUS.STARTUP_PENDING) {
    return 'Waiting for Shizuku to start';
  }
  if (normalizedStatus === SHIZUKU_STATUS.PERMISSION_PENDING) {
    return 'Shizuku permission approval pending';
  }

  return getClipboardCaptureUnavailableStatusMessage(normalizedStatus);
};

export const getClipboardCaptureUnavailableStatusMessage = status => {
  const message = getClipboardCaptureUnavailableMessage(status);
  return message ? `⚠️ ${message}` : '';
};

export const isClipboardCaptureUnavailableStatusMessage = message => {
  const normalizedMessage = String(message || '').trim();
  if (!normalizedMessage) {
    return false;
  }

  return Object.values(SHIZUKU_STATUS).some(
    status =>
      getClipboardCaptureUnavailableStatusMessage(status) ===
      normalizedMessage,
  ) || normalizedMessage === SHIZUKU_URI_ACCESS_UNAVAILABLE_STATUS_MESSAGE;
};

export const isClipboardCaptureStatusMessageClearableOnRecovery = message => {
  const normalizedMessage = String(message || '').trim();
  if (!normalizedMessage) {
    return false;
  }

  return Object.values(SHIZUKU_STATUS).some(
    status => getClipboardCaptureStatusMessage(status) === normalizedMessage,
  ) || normalizedMessage === SHIZUKU_URI_ACCESS_UNAVAILABLE_STATUS_MESSAGE;
};

export const SHIZUKU_STATUS = {
  DISABLED: 'disabled',
  NOT_INSTALLED: 'not_installed',
  NOT_AUTHORIZED: 'not_authorized',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  UNSUPPORTED: 'unsupported',
};

export const CLIPBOARD_CAPTURE_BACKEND = {
  LEGACY: 'legacy',
  SHIZUKU: 'shizuku',
  PAUSED: 'paused',
};

const validShizukuStatuses = new Set(Object.values(SHIZUKU_STATUS));

const normalizeShizukuStatus = status =>
  validShizukuStatuses.has(status) ? status : SHIZUKU_STATUS.DISCONNECTED;

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

  return {
    backend: CLIPBOARD_CAPTURE_BACKEND.PAUSED,
    shizukuStatus: normalizedStatus,
    automaticCaptureEnabled: false,
    shouldNotifyUnavailable: true,
  };
};

export const getClipboardCaptureUnavailableMessage = status => {
  switch (normalizeShizukuStatus(status)) {
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

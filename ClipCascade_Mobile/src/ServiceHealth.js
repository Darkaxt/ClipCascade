export const DEFAULT_HEALTH_CHECK_ATTEMPTS = 80;
export const DEFAULT_HEALTH_CHECK_INTERVAL_MS = 250;

export const SERVICE_UNRESPONSIVE_MESSAGE =
  '⚠️ Foreground service did not respond; tap Start or Restart Service';

export const getStartupServiceState = (
  wsIsRunning,
  foregroundServiceIsActive,
) => {
  if (wsIsRunning !== 'true') {
    return {
      wsIsRunningForUi: 'false',
      shouldPersistWsIsRunning: false,
      missedHeartbeat: false,
      statusMessage: '',
    };
  }

  if (foregroundServiceIsActive) {
    return {
      wsIsRunningForUi: 'true',
      shouldPersistWsIsRunning: false,
      missedHeartbeat: false,
      statusMessage: '',
    };
  }

  return {
    wsIsRunningForUi: 'false',
    shouldPersistWsIsRunning: false,
    missedHeartbeat: true,
    statusMessage: SERVICE_UNRESPONSIVE_MESSAGE,
  };
};

export const shouldPersistStoppedStateAfterSessionValidation =
  startupServiceState => startupServiceState?.missedHeartbeat !== true;

export const resolveClipboardLimit = (value, serverMaxSize) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed === 0) {
    return serverMaxSize;
  }
  return parsed;
};

export const normalizeBooleanText = (value, fallback = 'false') => {
  if (value === 'true' || value === 'false') {
    return value;
  }
  return fallback;
};

export const normalizeRuntimeSettings = (
  currentSettings,
  latestSettings,
  serverMaxSize,
) => ({
  enable_shizuku_clipboard_backend: normalizeBooleanText(
    latestSettings.enable_shizuku_clipboard_backend,
    currentSettings.enable_shizuku_clipboard_backend || 'false',
  ),
  enable_image_sharing: normalizeBooleanText(
    latestSettings.enable_image_sharing,
    currentSettings.enable_image_sharing,
  ),
  enable_file_sharing: normalizeBooleanText(
    latestSettings.enable_file_sharing,
    currentSettings.enable_file_sharing,
  ),
  enable_websocket_status_notification: normalizeBooleanText(
    latestSettings.enable_websocket_status_notification,
    currentSettings.enable_websocket_status_notification,
  ),
  max_clipboard_size_local_limit_bytes: resolveClipboardLimit(
    latestSettings.max_clipboard_size_local_limit_bytes,
    serverMaxSize,
  ),
});

export const probeForegroundService = async ({
  setData,
  getData,
  attempts = DEFAULT_HEALTH_CHECK_ATTEMPTS,
  intervalMs = DEFAULT_HEALTH_CHECK_INTERVAL_MS,
}) => {
  await setData('echo', 'ping');

  let remaining = attempts;
  while (remaining > 0) {
    await new Promise(resolve => setTimeout(resolve, intervalMs));
    const echo = await getData('echo');
    if (echo === 'pong') {
      return true;
    }
    remaining--;
  }

  return false;
};

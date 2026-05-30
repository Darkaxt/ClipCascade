import {
  setDataInAsyncStorage,
  getDataFromAsyncStorage,
} from './AsyncStorageManagement'; // persistent storage
import StartForegroundService from './StartForegroundService'; // foreground service

module.exports = async data => {
  try {
    const enableForegroundService = async () => {
      // Get websocket(foreground service) status (enabled/disabled)
      let wsIsRunning_s = await getDataFromAsyncStorage('wsIsRunning');
      return wsIsRunning_s === null ? 'false' : wsIsRunning_s;
    };

    const restartForegroundService = async () => {
      if ((await enableForegroundService()) === 'true') {
        await setDataInAsyncStorage('foreground_service_stopped_running', 'false');
        await setDataInAsyncStorage('wsStatusMessage', '');
        const result = await StartForegroundService();
        if (result[0] === false) {
          throw result[1];
        }
      }
    };

    if (data && data.event === 'SERVICE_INACTIVE') {
      await restartForegroundService();
    } else if (data && data.event === 'BOOT_COMPLETED') {
      const relaunch_on_boot = await getDataFromAsyncStorage(
        'relaunch_on_boot',
      );
      if (relaunch_on_boot !== null && relaunch_on_boot === 'true') {
        await restartForegroundService();
      }
    }
  } catch (e) {
    console.error('Error in Headless JS Task:', e);
  }
};

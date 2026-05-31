import { NativeModules } from 'react-native';
import {
  setDataInAsyncStorage,
  getDataFromAsyncStorage,
} from './AsyncStorageManagement'; // persistent storage
import StartForegroundService from './StartForegroundService'; // foreground service

module.exports = async data => {
  try {
    console.log('ClipCascade HeadlessTask received event:', data?.event);

    const enableForegroundService = async () => {
      // Get websocket(foreground service) status (enabled/disabled)
      let wsIsRunning_s = await getDataFromAsyncStorage('wsIsRunning');
      console.log('ClipCascade HeadlessTask wsIsRunning:', wsIsRunning_s);
      return wsIsRunning_s === null ? 'false' : wsIsRunning_s;
    };

    const restartForegroundService = async () => {
      if ((await enableForegroundService()) === 'true') {
        console.log('ClipCascade HeadlessTask restarting foreground service');
        await setDataInAsyncStorage(
          'foreground_service_stopped_running',
          'false',
        );
        await setDataInAsyncStorage('wsStatusMessage', '');
        const result = await StartForegroundService();
        if (result[0] === false) {
          console.warn(
            'ClipCascade HeadlessTask foreground restart failed:',
            result[1],
          );
          throw result[1];
        }
        NativeModules.NativeBridgeModule?.clearInactiveServiceNotification?.();
        console.log('ClipCascade HeadlessTask foreground restart requested');
      } else {
        console.log(
          'ClipCascade HeadlessTask skipped restart; service disabled',
        );
      }
    };

    if (data && data.event === 'SERVICE_INACTIVE') {
      await restartForegroundService();
    } else if (data && data.event === 'BOOT_COMPLETED') {
      const relaunch_on_boot = await getDataFromAsyncStorage(
        'relaunch_on_boot',
      );
      console.log(
        'ClipCascade HeadlessTask relaunch_on_boot:',
        relaunch_on_boot,
      );
      if (relaunch_on_boot !== null && relaunch_on_boot === 'true') {
        await restartForegroundService();
      }
    }
  } catch (e) {
    console.error('Error in Headless JS Task:', e);
  }
};

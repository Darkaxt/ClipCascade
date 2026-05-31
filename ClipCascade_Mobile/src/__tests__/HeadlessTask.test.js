jest.mock('../AsyncStorageManagement', () => ({
  getDataFromAsyncStorage: jest.fn(),
  setDataInAsyncStorage: jest.fn(),
  clearAsyncStorage: jest.fn(),
}));

jest.mock('../StartForegroundService', () => jest.fn());
jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    stopForegroundService: jest.fn(async () => {}),
  },
}));

const { NativeModules } = require('react-native');
const notifee = require('@notifee/react-native').default;
const {
  getDataFromAsyncStorage,
  setDataInAsyncStorage,
} = require('../AsyncStorageManagement');
const StartForegroundService = require('../StartForegroundService');

const runHeadlessTask = require('../HeadlessTask');

describe('headless foreground service restart', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    NativeModules.NativeBridgeModule = {
      clearInactiveServiceNotification: jest.fn(),
    };
    StartForegroundService.mockResolvedValue([true]);
  });

  test('restarts when the watchdog reports an inactive running service', async () => {
    getDataFromAsyncStorage.mockImplementation(async key => {
      if (key === 'wsIsRunning') {
        return 'true';
      }
      return null;
    });

    await runHeadlessTask({ event: 'SERVICE_INACTIVE' });

    expect(setDataInAsyncStorage).toHaveBeenCalledWith('wsStatusMessage', '');
    expect(StartForegroundService).toHaveBeenCalledTimes(1);
  });

  test('stops stale Notifee foreground service before watchdog restart', async () => {
    getDataFromAsyncStorage.mockImplementation(async key => {
      if (key === 'wsIsRunning') {
        return 'true';
      }
      return null;
    });

    await runHeadlessTask({ event: 'SERVICE_INACTIVE' });

    expect(notifee.stopForegroundService).toHaveBeenCalledTimes(1);
    expect(StartForegroundService).toHaveBeenCalledTimes(1);
    expect(
      notifee.stopForegroundService.mock.invocationCallOrder[0],
    ).toBeLessThan(StartForegroundService.mock.invocationCallOrder[0]);
  });

  test('clears stale inactive notification after a successful watchdog restart', async () => {
    getDataFromAsyncStorage.mockImplementation(async key => {
      if (key === 'wsIsRunning') {
        return 'true';
      }
      return null;
    });

    await runHeadlessTask({ event: 'SERVICE_INACTIVE' });

    expect(
      NativeModules.NativeBridgeModule.clearInactiveServiceNotification,
    ).toHaveBeenCalledTimes(1);
  });

  test('keeps boot restart gated by relaunch on boot', async () => {
    getDataFromAsyncStorage.mockImplementation(async key => {
      if (key === 'relaunch_on_boot') {
        return 'false';
      }
      if (key === 'wsIsRunning') {
        return 'true';
      }
      return null;
    });

    await runHeadlessTask({ event: 'BOOT_COMPLETED' });

    expect(StartForegroundService).not.toHaveBeenCalled();
  });
});

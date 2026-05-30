jest.mock('../AsyncStorageManagement', () => ({
  getDataFromAsyncStorage: jest.fn(),
  setDataInAsyncStorage: jest.fn(),
  clearAsyncStorage: jest.fn(),
}));

jest.mock('../StartForegroundService', () => jest.fn());

const {
  getDataFromAsyncStorage,
  setDataInAsyncStorage,
} = require('../AsyncStorageManagement');
const StartForegroundService = require('../StartForegroundService');

const runHeadlessTask = require('../HeadlessTask');

describe('headless foreground service restart', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

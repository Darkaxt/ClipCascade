jest.mock('react-native', () => ({
  NativeEventEmitter: jest.fn(),
  NativeModules: {},
  DeviceEventEmitter: {
    removeAllListeners: jest.fn(),
  },
  Alert: {
    alert: jest.fn(),
  },
}));

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  AndroidImportance: {
    DEFAULT: 3,
    HIGH: 4,
    LOW: 2,
  },
  default: {
    createChannel: jest.fn(async ({ id }) => id),
    displayNotification: jest.fn(async () => {}),
    registerForegroundService: jest.fn(),
  },
}));

jest.mock('@stomp/stompjs', () => ({
  Client: jest.fn(),
}));

jest.mock('react-native-aes-gcm-crypto', () => ({
  encrypt: jest.fn(),
  decrypt: jest.fn(),
}));

jest.mock('react-native-webrtc', () => ({
  RTCPeerConnection: jest.fn(),
  RTCIceCandidate: jest.fn(),
  RTCSessionDescription: jest.fn(),
}));

jest.mock('@react-native-clipboard/clipboard', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../AsyncStorageManagement', () => ({
  setDataInAsyncStorage: jest.fn(),
  getDataFromAsyncStorage: jest.fn(),
  getMultipleDataFromAsyncStorage: jest.fn(),
  clearAsyncStorage: jest.fn(),
}));

const notifee = require('@notifee/react-native').default;
const StartForegroundService = require('../StartForegroundService');

describe('StartForegroundService notification contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('uses a stable visible notification for the foreground service', async () => {
    await StartForegroundService();

    expect(notifee.createChannel).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'ClipCascade_Foreground_Service',
        name: 'ClipCascade Monitor',
      }),
    );
    expect(notifee.displayNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'ClipCascade_Foreground_Service_Notification_Id',
        title: 'ClipCascade',
        android: expect.objectContaining({
          channelId: 'ClipCascade_Foreground_Service',
          asForegroundService: true,
        }),
      }),
    );
  });
});

let mockNativeEventListeners = {};
let mockNativeModules;
let mockWsIsRunning = true;

jest.mock('react-native', () => ({
  NativeEventEmitter: jest.fn().mockImplementation(() => ({
    addListener: jest.fn((eventName, callback) => {
      mockNativeEventListeners[eventName] = callback;
      return { remove: jest.fn() };
    }),
  })),
  NativeModules: mockNativeModules,
  DeviceEventEmitter: {
    addListener: jest.fn((eventName, callback) => {
      mockNativeEventListeners[eventName] = callback;
      return { remove: jest.fn() };
    }),
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
    cancelNotification: jest.fn(async () => {}),
    displayNotification: jest.fn(async () => {}),
    getDisplayedNotifications: jest.fn(async () => []),
    registerForegroundService: jest.fn(),
    stopForegroundService: jest.fn(async () => {}),
  },
}));

jest.mock('@stomp/stompjs', () => ({
  Client: jest.fn().mockImplementation(function StompClient(config) {
    this.connected = false;
    this.publish = jest.fn();
    this.subscribe = jest.fn();
    this.activate = jest.fn(async () => {
      this.connected = true;
      await config.onConnect?.();
    });
    this.deactivate = jest.fn(async () => {
      this.connected = false;
    });
  }),
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

jest.mock('../ClipboardEventLog', () => ({
  appendClipboardEvent: jest.fn(),
  clearClipboardEvents: jest.fn(),
}));

mockNativeModules = {
  NativeBridgeModule: {
    clearInactiveServiceNotification: jest.fn(),
    getFlagsSync: jest.fn(),
  },
  ClipboardListener: {
    startListening: jest.fn(async () => 'enabled'),
    stopListening: jest.fn(async () => {}),
  },
  ShizukuClipboard: {
    getStatus: jest.fn(async () => 'disabled'),
    startListening: jest.fn(async () => 'disabled'),
    stopListening: jest.fn(async () => {}),
  },
};

const notifee = require('@notifee/react-native').default;
const {
  appendClipboardEvent,
} = require('../ClipboardEventLog');
const {
  getDataFromAsyncStorage,
  getMultipleDataFromAsyncStorage,
  setDataInAsyncStorage,
} = require('../AsyncStorageManagement');
const { Client } = require('@stomp/stompjs');
const {
  armLocalClipboardReplay,
} = require('../LocalClipboardReplay');
const StartForegroundService = require('../StartForegroundService');

describe('StartForegroundService notification contract', () => {
  let storage;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    storage = {};
    mockNativeEventListeners = {};
    mockWsIsRunning = true;
    mockNativeModules.NativeBridgeModule.getFlagsSync.mockImplementation(() =>
      JSON.stringify({
        wsIsRunning: mockWsIsRunning ? 'true' : 'false',
        echo: '',
        downloadFiles: 'false',
        filesAvailableToDownload: 'false',
        enable_image_sharing: 'true',
        enable_file_sharing: 'true',
        enable_shizuku_clipboard_backend: 'false',
        enable_websocket_status_notification: 'false',
        max_clipboard_size_local_limit_bytes: '1048576',
      }),
    );
    getMultipleDataFromAsyncStorage.mockResolvedValue({
      websocket_url: 'wss://clipcascade.example/clip',
      cipher_enabled: 'false',
      maxsize: '1048576',
      server_mode: 'P2S',
      stun_url: '',
      enable_image_sharing: 'true',
      enable_file_sharing: 'true',
      enable_shizuku_clipboard_backend: 'false',
      enable_websocket_status_notification: 'false',
      max_clipboard_size_local_limit_bytes: '1048576',
      api_key: 'cck_test',
    });
    getDataFromAsyncStorage.mockImplementation(async key => storage[key] || '');
    setDataInAsyncStorage.mockImplementation(async (key, value) => {
      storage[key] = value;
    });
  });

  afterEach(() => {
    jest.useRealTimers();
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

  test('does not require server self-echo before sending another P2S clipboard item', async () => {
    await StartForegroundService();
    const foregroundCallback = notifee.registerForegroundService.mock.calls[0][0];
    foregroundCallback({
      id: 'ClipCascade_Foreground_Service_Notification_Id',
    });

    for (
      let attempts = 0;
      attempts < 20 &&
      (!Client.mock.instances[0]?.activate ||
        !mockNativeEventListeners.onClipboardChange);
      attempts += 1
    ) {
      await Promise.resolve();
    }

    const stompInstance = Client.mock.instances[0];
    await stompInstance.activate.mock.results[0].value;

    expect(mockNativeEventListeners.onClipboardChange).toEqual(
      expect.any(Function),
    );

    await mockNativeEventListeners.onClipboardChange({
      type: 'text',
      content: 'first local clipboard',
      backend: 'legacy',
    });
    await mockNativeEventListeners.onClipboardChange({
      type: 'text',
      content: 'second local clipboard',
      backend: 'legacy',
    });

    expect(stompInstance.publish).toHaveBeenCalledTimes(2);
    expect(appendClipboardEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        direction: 'outbound',
        status: 'Sent',
        content: 'first local clipboard',
      }),
    );
    expect(appendClipboardEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        direction: 'outbound',
        status: 'Sent',
        content: 'second local clipboard',
      }),
    );

    mockWsIsRunning = false;
    jest.advanceTimersByTime(1000);
    await Promise.resolve();
  });

  test('does not send text restored from activity history', async () => {
    await StartForegroundService();
    const foregroundCallback = notifee.registerForegroundService.mock.calls[0][0];
    foregroundCallback({
      id: 'ClipCascade_Foreground_Service_Notification_Id',
    });

    for (
      let attempts = 0;
      attempts < 20 &&
      (!Client.mock.instances[0]?.activate ||
        !mockNativeEventListeners.onClipboardChange);
      attempts += 1
    ) {
      await Promise.resolve();
    }

    const stompInstance = Client.mock.instances[0];
    await stompInstance.activate.mock.results[0].value;
    await armLocalClipboardReplay({
      setValue: setDataInAsyncStorage,
      content: 'history-only text',
    });

    await mockNativeEventListeners.onClipboardChange({
      type: 'text',
      content: 'history-only text',
      backend: 'legacy',
    });

    expect(stompInstance.publish).not.toHaveBeenCalled();
    expect(appendClipboardEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({
        direction: 'outbound',
        content: 'history-only text',
      }),
    );
  });
});

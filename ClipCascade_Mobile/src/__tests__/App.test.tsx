/**
 * @format
 */

import React from 'react';
import { NativeModules } from 'react-native';
import App from '../App';

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    cancelAllNotifications: jest.fn(),
    cancelNotification: jest.fn(),
    createChannel: jest.fn(() => Promise.resolve('ClipCascade')),
    displayNotification: jest.fn(() => Promise.resolve()),
    isBatteryOptimizationEnabled: jest.fn(() => Promise.resolve(false)),
    openBatteryOptimizationSettings: jest.fn(() => Promise.resolve()),
    openPowerManagerSettings: jest.fn(() => Promise.resolve()),
    stopForegroundService: jest.fn(() => Promise.resolve()),
  },
  AndroidImportance: {
    DEFAULT: 3,
    HIGH: 4,
    LOW: 2,
  },
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@react-native-clipboard/clipboard', () => ({
  setString: jest.fn(),
}));

jest.mock('@react-native-documents/picker', () => ({
  isCancel: jest.fn(() => false),
  pickDirectory: jest.fn(),
}));

jest.mock('@react-native-module/pbkdf2', () => ({
  pbkdf2: jest.fn(),
}));

jest.mock('react-native-aes-gcm-crypto', () => ({
  decrypt: jest.fn(),
  encrypt: jest.fn(),
}));

jest.mock('react-native-webrtc', () => ({
  RTCIceCandidate: jest.fn(),
  RTCPeerConnection: jest.fn(),
  RTCSessionDescription: jest.fn(),
}));

NativeModules.NativeBridgeModule = {
  clearCookies: jest.fn(() => Promise.resolve()),
  clearImageCache: jest.fn(() => Promise.resolve()),
  getFlagsSync: jest.fn(() =>
    JSON.stringify({
      filesAvailableToDownload: 'false',
      p2pStatusMessage: '',
      server_mode: 'P2S',
      wsIsRunning: 'false',
      wsStatusMessage: '',
    }),
  ),
  startWorkManager: jest.fn(),
  stopWorkManager: jest.fn(),
};

test('exports the app component', () => {
  expect(App).toBeDefined();
});

import { NativeModules } from 'react-native';

import { getInstalledAppVersion } from '../AppVersion';

describe('installed app version', () => {
  afterEach(() => {
    delete NativeModules.NativeBridgeModule;
  });

  test('reads the installed app version from the native bridge', () => {
    NativeModules.NativeBridgeModule = {
      appVersionName: '3.2.0.12',
    };

    expect(getInstalledAppVersion()).toBe('3.2.0.12');
  });

  test('does not invent a fallback app version when native metadata is missing', () => {
    NativeModules.NativeBridgeModule = {};

    expect(getInstalledAppVersion()).toBeNull();
  });
});

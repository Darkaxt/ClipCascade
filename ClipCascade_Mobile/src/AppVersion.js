import { NativeModules } from 'react-native';

export const getInstalledAppVersion = () => {
  const versionName = NativeModules.NativeBridgeModule?.appVersionName;
  if (typeof versionName !== 'string') {
    return null;
  }

  const trimmedVersionName = versionName.trim();
  return trimmedVersionName === '' ? null : trimmedVersionName;
};

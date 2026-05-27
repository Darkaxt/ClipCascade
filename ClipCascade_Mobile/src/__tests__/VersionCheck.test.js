import { shouldShowNewVersion } from '../VersionCheck';

describe('version update checks', () => {
  test('does not show an older upstream version as an update for a fork suffix', () => {
    expect(shouldShowNewVersion('3.2.0.1', '3.2.0')).toBe(false);
  });

  test('shows a higher fork revision as an update', () => {
    expect(shouldShowNewVersion('3.2.0.1', '3.2.0.2')).toBe(true);
  });

  test('shows a higher upstream version as an update', () => {
    expect(shouldShowNewVersion('3.2.0.1', '3.2.1')).toBe(true);
  });
});

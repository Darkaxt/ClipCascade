import {
  LOGIN_EXTRA_CONFIG_KEYS,
  SETTINGS_CATEGORIES,
  RUNTIME_SETTINGS_KEYS,
} from '../SettingsConfig';

describe('settings placement', () => {
  test('keeps runtime service settings out of the login extra config', () => {
    expect(LOGIN_EXTRA_CONFIG_KEYS).toEqual([
      'hash_rounds',
      'salt',
      'save_password',
      'api_key',
      'api_client_name',
    ]);

    expect(LOGIN_EXTRA_CONFIG_KEYS).not.toEqual(
      expect.arrayContaining(RUNTIME_SETTINGS_KEYS),
    );
  });

  test('exposes mutable service options as runtime settings', () => {
    expect(RUNTIME_SETTINGS_KEYS).toEqual([
      'max_clipboard_size_local_limit_bytes',
      'enable_image_sharing',
      'enable_file_sharing',
      'relaunch_on_boot',
      'enable_shizuku_clipboard_backend',
      'enable_websocket_status_notification',
      'enable_periodic_checks',
    ]);
  });

  test('organizes settings into expandable runtime categories', () => {
    expect(SETTINGS_CATEGORIES.map(category => category.id)).toEqual([
      'sync',
      'service',
      'performance',
      'help',
    ]);

    const categoryFields = Object.fromEntries(
      SETTINGS_CATEGORIES.map(category => [
        category.id,
        (category.fields || []).map(field => field.key),
      ]),
    );

    expect(categoryFields.sync).toEqual([
      'max_clipboard_size_local_limit_bytes',
      'enable_image_sharing',
      'enable_file_sharing',
    ]);
    expect(categoryFields.service).toEqual([
      'relaunch_on_boot',
      'enable_shizuku_clipboard_backend',
      'enable_websocket_status_notification',
      'enable_periodic_checks',
    ]);
    expect(categoryFields.performance).toEqual([]);
    expect(categoryFields.help).toEqual([]);
  });

  test('derives persisted runtime keys from settings categories only', () => {
    const persistedCategoryKeys = SETTINGS_CATEGORIES.flatMap(category =>
      (category.fields || [])
        .filter(field => field.persisted !== false)
        .map(field => field.key),
    );

    expect(RUNTIME_SETTINGS_KEYS).toEqual(persistedCategoryKeys);
  });
});

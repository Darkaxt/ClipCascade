export const LOGIN_EXTRA_CONFIG_KEYS = [
  'hash_rounds',
  'salt',
  'save_password',
  'api_key',
  'api_client_name',
  'sync_encryption_key',
];

export const SETTINGS_CATEGORIES = [
  {
    id: 'sync',
    title: 'Sync',
    description: 'Clipboard size limits and payload types.',
    fields: [
      {
        key: 'max_clipboard_size_local_limit_bytes',
        label: 'Maximum Clipboard Size Local Limit (in bytes):',
        type: 'number',
      },
      {
        key: 'enable_image_sharing',
        label: 'Enable Image Sharing:',
        type: 'boolean',
      },
      {
        key: 'enable_file_sharing',
        label: 'Enable File Sharing:',
        type: 'boolean',
      },
    ],
  },
  {
    id: 'service',
    title: 'Service',
    description: 'Startup, health checks, and foreground notifications.',
    fields: [
      {
        key: 'relaunch_on_boot',
        label: 'Run on system startup:',
        type: 'boolean',
      },
      {
        key: 'enable_shizuku_clipboard_backend',
        label: 'Use Shizuku clipboard backend:',
        type: 'boolean',
      },
      {
        key: 'enable_websocket_status_notification',
        label: 'Enable WebSocket Status Notification:',
        type: 'boolean',
      },
      {
        key: 'enable_periodic_checks',
        label: 'Enable Periodic Checks:',
        type: 'boolean',
      },
    ],
  },
  {
    id: 'performance',
    title: 'Performance',
    description: 'Android power controls that keep syncing active.',
    fields: [],
    actions: ['battery_optimization', 'power_manager'],
  },
  {
    id: 'help',
    title: 'Help',
    description: 'Android clipboard behavior and ADB setup notes.',
    fields: [],
  },
];

export const RUNTIME_SETTINGS_KEYS = SETTINGS_CATEGORIES.flatMap(category =>
  category.fields
    .filter(field => field.persisted !== false)
    .map(field => field.key),
);

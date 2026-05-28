import {
  buildAuthHeaders,
  buildStompConnectHeaders,
  clearRejectedApiAuth,
  hasApiKey,
} from '../AuthConfig';

describe('AuthConfig', () => {
  test('detects configured API keys', () => {
    expect(hasApiKey({ api_key: ' cck_secret ' })).toBe(true);
    expect(hasApiKey({ api_key: '' })).toBe(false);
    expect(hasApiKey({})).toBe(false);
  });

  test('HTTP auth headers prefer API key over cookie', () => {
    expect(
      buildAuthHeaders({
        api_key: ' cck_secret ',
      }, 'SESSION=abc;'),
    ).toEqual({ 'X-ClipCascade-Api-Key': 'cck_secret' });
  });

  test('HTTP auth headers preserve legacy cookie path', () => {
    expect(buildAuthHeaders({}, 'SESSION=abc;')).toEqual({
      Cookie: 'SESSION=abc;',
    });
  });

  test('STOMP connect headers include API key only', () => {
    expect(buildStompConnectHeaders({ api_key: 'cck_secret' })).toEqual({
      'x-clipcascade-api-key': 'cck_secret',
    });
    expect(buildStompConnectHeaders({})).toEqual({});
  });

  test('clears rejected API auth while keeping reusable sync encryption key', () => {
    expect(
      clearRejectedApiAuth({
        api_key: 'cck_stale',
        api_client_id: 'client-123',
        api_client_name: 'Android phone',
        csrf_token: 'csrf',
        hashed_password: 'legacy',
        sync_encryption_key: 'ccsk_keep',
        server_url: 'https://clipcascade.example.test',
        username: 'admin',
      }),
    ).toEqual({
      api_key: '',
      api_client_id: '',
      api_client_name: '',
      csrf_token: '',
      hashed_password: '',
      sync_encryption_key: 'ccsk_keep',
      server_url: 'https://clipcascade.example.test',
      username: 'admin',
    });
  });
});

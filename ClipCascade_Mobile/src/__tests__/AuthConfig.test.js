import {
  buildAuthHeaders,
  buildStompConnectHeaders,
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
});

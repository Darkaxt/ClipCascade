export const hasApiKey = data => {
  return Boolean(String(data?.api_key || '').trim());
};

export const buildAuthHeaders = (data, cookieHeader = '') => {
  const apiKey = String(data?.api_key || '').trim();
  if (apiKey) {
    return { 'X-ClipCascade-Api-Key': apiKey };
  }

  if (cookieHeader) {
    return { Cookie: cookieHeader };
  }

  return {};
};

export const buildStompConnectHeaders = data => {
  const apiKey = String(data?.api_key || '').trim();
  if (apiKey) {
    return { 'x-clipcascade-api-key': apiKey };
  }

  return {};
};

export const buildWebSocketOptions = data => {
  const headers = buildAuthHeaders(data);
  if (Object.keys(headers).length === 0) {
    return undefined;
  }

  return { headers };
};

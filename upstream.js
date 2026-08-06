export function upstreamHeaders(apiKey = '') {
  const headers = { 'Content-Type': 'application/json' };
  const key = String(apiKey).trim();
  if (key) headers.Authorization = `Bearer ${key}`;
  return headers;
}

export async function sendRpc(body, options = {}) {
  const endpoint = options.endpoint || 'https://changethisfile.com/mcp';
  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: upstreamHeaders(options.apiKey),
    body: JSON.stringify(body),
  });
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text.trim()) return null;
  return JSON.parse(text);
}

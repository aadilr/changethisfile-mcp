import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { sendRpc } from '../upstream.js';

test('forwards CTF_API_KEY as a bearer token without putting it in payloads', async () => {
  const secret = 'ctf_sk_test_secret_never_log';
  let captured;
  const result = await sendRpc({ jsonrpc: '2.0', id: 7, method: 'tools/list' }, {
    endpoint: 'https://example.test/mcp',
    apiKey: secret,
    fetchImpl: async (url, init) => {
      captured = { url, init };
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: 7, result: { tools: [] } }));
    },
  });

  assert.equal(captured.url, 'https://example.test/mcp');
  assert.equal(captured.init.headers.Authorization, `Bearer ${secret}`);
  assert.doesNotMatch(captured.init.body, new RegExp(secret));
  assert.deepEqual(result, { jsonrpc: '2.0', id: 7, result: { tools: [] } });

  const shimSource = await readFile(new URL('../index.js', import.meta.url), 'utf8');
  assert.doesNotMatch(shimSource, /log\([^\n]*API_KEY/);
});

test('keeps compatibility requests anonymous when CTF_API_KEY is unset', async () => {
  let capturedHeaders;
  await sendRpc({ jsonrpc: '2.0', id: 8, method: 'tools/list' }, {
    endpoint: 'https://example.test/mcp',
    fetchImpl: async (_url, init) => {
      capturedHeaders = init.headers;
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: 8, result: { tools: [] } }));
    },
  });

  assert.equal(capturedHeaders.Authorization, undefined);
  assert.equal(capturedHeaders['Content-Type'], 'application/json');
});

test('documents the hosted seven-tool surface without legacy no-auth claims', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  for (const tool of [
    'convert_file',
    'list_conversions',
    'translate_file',
    'extract_tables',
    'compress_file',
    'do_file_job',
    'check_job',
  ]) {
    assert.ok(readme.includes(`| \`${tool}\` |`), tool);
  }
  assert.doesNotMatch(readme, /built-in free-tier key|No authentication or account required/);
  assert.match(readme, /compatibility mode/i);
});

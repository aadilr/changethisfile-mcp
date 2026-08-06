#!/usr/bin/env node
/**
 * changethisfile-mcp — stdio shim
 *
 * Bridges stdio-based MCP clients (Claude Desktop, Cursor, etc.) to the
 * remote ChangeThisFile MCP server at https://changethisfile.com/mcp
 * using the MCP streamable-HTTP transport (spec 2025-03-26).
 *
 * Usage in claude_desktop_config.json:
 *   {
 *     "mcpServers": {
 *       "changethisfile": {
 *         "command": "npx",
 *         "args": ["-y", "changethisfile-mcp"],
 *         "env": { "CTF_API_KEY": "ctf_sk_your_key_here" }
 *       }
 *     }
 *   }
 *
 * The shim reads JSON-RPC messages from stdin and forwards them as POST
 * requests to the remote endpoint, writing responses back to stdout.
 * Discovery and paid-preview jobs are public. CTF_API_KEY is optional during
 * compatibility mode and enables shared REST + MCP developer metering.
 */

import { sendRpc } from './upstream.js';

const REMOTE_URL = process.env.CTF_MCP_URL
  || process.env.CHANGETHISFILE_MCP_URL
  || 'https://changethisfile.com/mcp';
const API_KEY = (process.env.CTF_API_KEY || '').trim();
const DEBUG = process.env.CTF_MCP_DEBUG === '1';

function log(...args) {
  if (DEBUG) process.stderr.write('[ctf-mcp] ' + args.join(' ') + '\n');
}

let buf = '';
let pending = 0;
let stdinClosed = false;

function maybeExit() {
  if (stdinClosed && pending === 0) process.exit(0);
}

async function handleLine(line) {
  let body;
  try {
    body = JSON.parse(line);
  } catch (err) {
    process.stderr.write('[ctf-mcp] parse error: ' + err.message + '\n');
    return;
  }

  log('→', JSON.stringify(body));
  pending++;
  try {
    const resp = await sendRpc(body, { endpoint: REMOTE_URL, apiKey: API_KEY });
    if (resp !== null) {
      const out = JSON.stringify(resp) + '\n';
      log('←', out.trim());
      process.stdout.write(out);
    }
  } catch (err) {
    const errResp = {
      jsonrpc: '2.0',
      id: body.id ?? null,
      error: { code: -32603, message: 'Transport error', data: err.message },
    };
    process.stdout.write(JSON.stringify(errResp) + '\n');
  } finally {
    pending--;
    maybeExit();
  }
}

process.stdin.setEncoding('utf-8');
process.stdin.on('data', (chunk) => {
  buf += chunk;
  let newline;
  while ((newline = buf.indexOf('\n')) !== -1) {
    const line = buf.slice(0, newline).trim();
    buf = buf.slice(newline + 1);
    if (line) handleLine(line);
  }
});

// Don't exit while responses are in flight — the last reply would be dropped.
process.stdin.on('end', () => {
  if (buf.trim()) { handleLine(buf.trim()); buf = ''; }
  stdinClosed = true;
  maybeExit();
});

// Flush on SIGTERM
process.on('SIGTERM', () => process.exit(0));

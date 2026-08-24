#!/usr/bin/env node
/**
 * ChangeThisFile MCP Server (stdio)
 *
 * Convert files across 1,000+ routes — image, video, audio, document, data,
 * font, ebook, and archive — plus instruction-driven file jobs (translate,
 * extract tables, compress). Anonymous callers get 25 conversions/month per
 * network; set CTF_API_KEY (free verified key, 25/month shared with REST)
 * to use a per-account allowance.
 *
 * This is a thin stdio client for the hosted ChangeThisFile MCP endpoint
 * (https://changethisfile.com/mcp, streamable HTTP). Tool discovery is
 * answered locally; tool calls are forwarded to the hosted service, which
 * runs the actual conversion engines (FFmpeg, LibreOffice, Calibre, 7-Zip,
 * sharp, fonttools, Ghostscript, and more) and returns a signed download URL.
 *
 * If your MCP client supports streamable HTTP transport, you can skip this
 * package entirely and connect directly to https://changethisfile.com/mcp.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const ENDPOINT = process.env.CHANGETHISFILE_MCP_URL || 'https://changethisfile.com/mcp';
const SERVER_VERSION = '1.4.0';
// Optional: a verified ChangeThisFile API key (ctf_sk_…). Forwarded as the
// Authorization header so the hosted server meters your account instead of
// the anonymous per-network allowance. Get one: POST /v1/keys/free.
const API_KEY = (process.env.CTF_API_KEY || '').trim();

function hostedHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (API_KEY) headers.Authorization = `Bearer ${API_KEY}`;
  return headers;
}

// Fallback tool definitions mirror the two always-on hosted tools so
// discovery works offline. At startup we ask the hosted server for its full
// list (7 tools incl. translate/extract/compress/do_file_job/check_job) and
// use that when reachable.
const FALLBACK_TOOLS = [
  {
    name: 'convert_file',
    title: 'Convert File',
    description:
      'Convert a file from one format to another. Pass EITHER a publicly accessible URL (source_url) OR base64-encoded file contents (base64_content + source_format) — exactly one is required. Returns a temporary download URL (valid 1 hour; file deleted within 24 hours).',
    annotations: {
      title: 'Convert File',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    inputSchema: {
      type: 'object',
      properties: {
        source_url: {
          type: 'string',
          description: 'Publicly accessible URL of the file to convert (preferred for large files)',
        },
        base64_content: {
          type: 'string',
          description: 'Base64-encoded file content (for small files; max ~5MB)',
        },
        source_format: {
          type: 'string',
          description: 'Source format extension (e.g. "docx", "mp4"). Auto-detected from URL if omitted.',
        },
        target_format: {
          type: 'string',
          description: 'Target format extension (e.g. "json", "mp3", "pdf"). Required.',
        },
        filename: {
          type: 'string',
          description: 'Optional filename hint for auto-detection (e.g. "document.docx")',
        },
      },
      required: ['target_format'],
    },
  },
  {
    name: 'list_conversions',
    title: 'List Supported Conversions',
    description:
      'List all supported conversion routes. Optionally filter by source format to see what you can convert FROM a specific format.',
    annotations: {
      title: 'List Supported Conversions',
      readOnlyHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {
        source_format: {
          type: 'string',
          description: 'Filter by source format (e.g. "docx" returns all DOCX target options)',
        },
      },
      required: [],
    },
  },
];

let TOOLS = FALLBACK_TOOLS;

async function loadHostedTools() {
  try {
    const resp = await fetch(ENDPOINT, {
      method: 'POST',
      headers: hostedHeaders(),
      body: JSON.stringify({ jsonrpc: '2.0', id: 0, method: 'tools/list', params: {} }),
      signal: AbortSignal.timeout(8_000),
    });
    const body = await resp.json();
    if (Array.isArray(body?.result?.tools) && body.result.tools.length) {
      TOOLS = body.result.tools;
    }
  } catch {
    // Offline or blocked: keep the embedded fallback list.
  }
}

async function forwardToolCall(name, args) {
  let resp;
  try {
    resp = await fetch(ENDPOINT, {
      method: 'POST',
      headers: hostedHeaders(),
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name, arguments: args || {} },
      }),
      signal: AbortSignal.timeout(180_000),
    });
  } catch (err) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Could not reach the ChangeThisFile conversion service: ${err.message}` }],
    };
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    return {
      isError: true,
      content: [{ type: 'text', text: `Conversion service returned HTTP ${resp.status}: ${text.slice(0, 500)}` }],
    };
  }

  const body = await resp.json().catch(() => null);
  if (!body || (body.error == null && body.result == null)) {
    return {
      isError: true,
      content: [{ type: 'text', text: 'Conversion service returned an invalid response' }],
    };
  }
  if (body.error) {
    return {
      isError: true,
      content: [{ type: 'text', text: `${body.error.message}${body.error.data ? `: ${body.error.data}` : ''}` }],
    };
  }
  return body.result;
}

const server = new Server(
  { name: 'changethisfile', version: SERVER_VERSION },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  if (!TOOLS.some((t) => t.name === name)) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Unknown tool: ${name}` }],
    };
  }
  return forwardToolCall(name, args);
});

await loadHostedTools();
const transport = new StdioServerTransport();
await server.connect(transport);

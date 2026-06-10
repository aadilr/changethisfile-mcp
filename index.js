#!/usr/bin/env node
/**
 * ChangeThisFile MCP Server (stdio)
 *
 * Convert files between 690+ formats — image, video, audio, document, data,
 * font, ebook, and archive. Free, no auth required.
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
const SERVER_VERSION = '1.0.0';

// Tool definitions mirror the hosted server (https://changethisfile.com/mcp
// method tools/list) so discovery works offline.
const TOOLS = [
  {
    name: 'convert_file',
    title: 'Convert File',
    description:
      'Convert a file from one format to another. Pass either a publicly accessible URL (source_url) or base64-encoded file contents (base64_content). Returns a temporary download URL valid for 24 hours.',
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

async function forwardToolCall(name, args) {
  let resp;
  try {
    resp = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

const transport = new StdioServerTransport();
await server.connect(transport);

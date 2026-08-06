# ChangeThisFile MCP Server

Use ChangeThisFile's **seven file tools** from any MCP client: conversion across 1,000+ supported routes, document translation, table extraction, exact-size compression, natural-language routing, and job status checks.

Powered by [ChangeThisFile.com](https://changethisfile.com). Discovery and paid-preview jobs are public. General `convert_file` accepts a verified developer key now and shares its quota with REST API usage. Anonymous conversion remains available during the connector compatibility window; authentication will not be enforced before August 27, 2026, and only after connector support is verified.

## Tools

| Tool | Description |
|------|-------------|
| `convert_file` | Convert a file. Pass a publicly accessible `source_url` **or** `base64_content` (max ~5MB), plus a `target_format` (e.g. `pdf`, `mp3`, `json`). Source format is auto-detected from the URL/filename, or pass `source_format` explicitly. Returns a download URL valid for 1 hour. |
| `list_conversions` | List all supported conversion routes, optionally filtered by `source_format` (e.g. `docx` → see every format you can convert DOCX into). |
| `translate_file` | Translate a document with its layout preserved. Returns a free preview and a one-time checkout link for the full output. |
| `extract_tables` | Extract tables from PDFs or images into Excel. Returns a free preview and a one-time checkout link for the full output. |
| `compress_file` | Compress a PDF, image, or video to an exact maximum size. Free with a daily limit. |
| `do_file_job` | Route a plain-language file instruction to conversion, translation, extraction, or compression. |
| `check_job` | Check a submitted job and retrieve its preview, checkout link, or download URL. |

## Option 1 — Remote endpoint (recommended, no install)

The server is hosted at `https://changethisfile.com/mcp` using **streamable HTTP transport** (MCP spec 2025-03-26). If your client supports remote MCP servers, point it straight at the endpoint. Clients that support custom headers can send `Authorization: Bearer ctf_sk_...` to use authenticated developer metering.

```json
{
  "mcpServers": {
    "changethisfile": {
      "type": "streamable-http",
      "url": "https://changethisfile.com/mcp"
    }
  }
}
```

Claude Code:

```bash
claude mcp add --transport http changethisfile https://changethisfile.com/mcp
```

## Option 2 — Local stdio server (this package)

For clients that only speak stdio, this package bridges stdio ↔ the hosted endpoint:

```json
{
  "mcpServers": {
    "changethisfile": {
      "command": "npx",
      "args": ["-y", "github:aadilr/changethisfile-mcp"],
      "env": {
        "CTF_API_KEY": "ctf_sk_your_key_here"
      }
    }
  }
}
```

`CTF_API_KEY` is optional during compatibility mode. Get a verified free key from the [ChangeThisFile dashboard](https://changethisfile.com/dashboard); its 25 monthly conversions are shared across MCP and REST.

Or clone and run directly:

```bash
git clone https://github.com/aadilr/changethisfile-mcp.git
cd changethisfile-mcp
npm install
node index.js
```

## Option 3 — Agent Skill / Claude Code plugin

This repo doubles as an [Agent Skill](https://agentskills.io) and Claude Code plugin.

**Any skills-capable agent** (Claude Code, Codex CLI, Cursor, Gemini CLI, Copilot, and more):

```bash
npx skills add aadilr/changethisfile-mcp
```

**Claude Code plugin** (bundles the MCP server + the skill):

```
/plugin marketplace add aadilr/changethisfile-mcp
/plugin install changethisfile@changethisfile
```

The `file-conversion` skill prefers the MCP tools when connected and otherwise falls back to a bundled script (`skills/file-conversion/scripts/convert.sh`) that talks to the hosted endpoint over plain HTTPS — no MCP client required.

## Option 4 — Docker

```bash
docker build -t changethisfile-mcp .
docker run -i --rm -e CTF_API_KEY changethisfile-mcp
```

## Quick test

```bash
curl -X POST https://changethisfile.com/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

## Supported formats

| Category | Examples |
|----------|----------|
| Image | JPG, PNG, WebP, GIF, BMP, AVIF, ICO, SVG, TIFF, HEIC, PSD, RAW |
| Video | MP4, WebM, MKV, AVI, MOV, 3GP, FLV, WMV |
| Audio | MP3, WAV, FLAC, AAC, OGG, M4A, OPUS |
| Document | PDF, DOCX, DOC, ODT, RTF, TXT, HTML, MD, PPT, PPTX |
| Data | JSON, CSV, TSV, YAML, XML, TOML, XLSX, XLS |
| Font | TTF, OTF, WOFF, WOFF2 |
| Ebook | EPUB, MOBI, AZW3, FB2, CBR, CBZ |
| Archive | ZIP, RAR, 7Z, TAR, TAR.GZ, TAR.BZ2, TAR.XZ |

Use `list_conversions` for the full route table.

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `CTF_API_KEY` | unset | Optional verified developer key forwarded as a bearer token; the value is never logged |
| `CTF_MCP_URL` | `https://changethisfile.com/mcp` | Override the upstream endpoint |
| `CHANGETHISFILE_MCP_URL` | unset | Legacy alias for `CTF_MCP_URL` |

## Privacy & limits

- Discovery and paid-preview jobs require no account. General conversion is temporarily anonymous in compatibility mode; a verified key enables shared developer metering now.
- Files are processed server-side and **auto-deleted within 24 hours**; download URLs expire after 1 hour.
- MCP inputs are capped at 25 MB. Authenticated `convert_file` uses the developer account's shared API/MCP rate and monthly quota; other expensive tools retain per-account or per-IP abuse limits.

## License

MIT

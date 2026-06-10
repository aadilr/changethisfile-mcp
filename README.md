# ChangeThisFile MCP Server

Convert files between **690+ formats** from any MCP client — image, video, audio, document, data, spreadsheet, font, ebook, and archive. Free, no API key, no signup.

Powered by [ChangeThisFile.com](https://changethisfile.com). Conversions run on real engines (FFmpeg, LibreOffice, Calibre, 7-Zip, sharp, Ghostscript, fonttools, and more) and return a temporary signed download URL. Uploaded files are auto-deleted within 24 hours.

## Tools

| Tool | Description |
|------|-------------|
| `convert_file` | Convert a file. Pass a publicly accessible `source_url` **or** `base64_content` (max ~5MB), plus a `target_format` (e.g. `pdf`, `mp3`, `json`). Source format is auto-detected from the URL/filename, or pass `source_format` explicitly. Returns a download URL valid for 1 hour. |
| `list_conversions` | List all supported conversion routes, optionally filtered by `source_format` (e.g. `docx` → see every format you can convert DOCX into). |

## Option 1 — Remote endpoint (recommended, no install)

The server is hosted at `https://changethisfile.com/mcp` using **streamable HTTP transport** (MCP spec 2025-03-26). If your client supports remote MCP servers, point it straight at the endpoint:

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
      "args": ["-y", "github:aadilr/changethisfile-mcp"]
    }
  }
}
```

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
docker run -i --rm changethisfile-mcp
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
| `CHANGETHISFILE_MCP_URL` | `https://changethisfile.com/mcp` | Override the upstream endpoint |

## Privacy & limits

- No authentication or account required.
- Files are processed server-side and **auto-deleted within 24 hours**; download URLs expire after 1 hour.
- Per-IP rate limiting applies. For higher volume, see the [authenticated API](https://changethisfile.com/api).

## License

MIT

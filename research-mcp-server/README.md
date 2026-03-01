# Research MCP Server

A local [Model Context Protocol](https://modelcontextprotocol.io/) server that provides free research tools — no API keys needed.

## Tools

| Tool | Description |
|------|-------------|
| `search_web` | Search the web via DuckDuckGo |
| `fetch_url` | Extract clean text/markdown from any URL |
| `search_arxiv` | Search arXiv for academic papers |
| `search_wikipedia` | Look up Wikipedia articles |
| `summarize_text` | Extractive text summarization |

## Setup

```bash
# Install dependencies
cd research-mcp-server
pip install -r requirements.txt

# Test that it imports cleanly
python -c "import server; print('OK')"
```

## Usage

### Standalone (stdio transport)
```bash
python server.py
```

### With VS Code / Gemini
The `.vscode/mcp.json` in the project root is pre-configured. Open the project in VS Code and the server will be auto-discovered.

### With Claude Desktop
Add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "research": {
      "command": "python",
      "args": ["path/to/research-mcp-server/server.py"]
    }
  }
}
```

## Examples

Once connected, you can use these tools through your AI assistant:

- **Search the web**: "Search for recent advances in distributed file systems"
- **Read a page**: "Fetch the content from https://en.wikipedia.org/wiki/Erasure_code"
- **Find papers**: "Search arXiv for satellite communication relay protocols"
- **Quick lookup**: "Look up Reed-Solomon error correction on Wikipedia"
- **Summarize**: "Summarize this long paragraph about orbital mechanics..."

## Architecture

```
server.py
├── search_web()       → DuckDuckGo HTML scraping
├── fetch_url()        → httpx + BeautifulSoup → Markdown
├── search_arxiv()     → arXiv Atom API
├── search_wikipedia() → Wikipedia REST API
└── summarize_text()   → Extractive (word-frequency scoring)
```

All tools are async and use `httpx` for HTTP requests. No external API keys or paid services.

# Slither MCP Server

An MCP (Model Context Protocol) server that provides static analysis capabilities for Solidity smart contracts using [Slither](https://github.com/crytic/slither).

## How it works

The server wraps Slither static analysis functionality, making it accessible through the Model Context Protocol. It can analyze Solidity projects (Foundry, Hardhat, etc.) and cache results for faster subsequent queries.

## Features

- **Caching**: Slither runs are cached to `{$PROJECT_PATH}/artifacts/project_facts.json` for faster subsequent loads
- **Security Analysis**: Run Slither detectors and access results with filtering  
- **Contract Analysis**: Get detailed information about contracts, functions, and inheritance
- **Project Support**: Works with Foundry, Hardhat, and other Solidity project types

## Tools

| Tool | Description |
|------|-------------|
| `analyze_files` | Run Slither static analysis on specific Solidity files |
| `run_detectors` | Run specific Slither detectors on file list |
| `get_contract_info` | Get detailed information about contracts in files |

## Requirements

### Local Development
- Node.js 18+
- Slither analyzer installed: `pip install slither-analyzer`
- Solidity compiler (usually comes with Foundry or Hardhat)

### Docker (Recommended)
- Docker and Docker Compose
- No additional setup required

## Quick Start (Docker)

```bash
# Start the integrated security toolbox + MCP server
docker compose up slither-mcp

# Access interactive shell with all security tools
docker compose exec slither-mcp bash
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check — includes cached analysis count |
| `POST` | `/mcp` | MCP Streamable HTTP — initialize session or send request |
| `GET` | `/mcp` | MCP SSE stream for an existing session |
| `DELETE` | `/mcp` | Close an existing session |

## Development

```bash
npm install
npm run dev
```

## Docker Integration

This server integrates with the [eth-security-toolbox](https://github.com/trailofbits/eth-security-toolbox) providing:
- **Slither** - Static analysis
- **Foundry** - Development framework  
- **Echidna** - Property-based testing
- **Medusa** - Advanced fuzzing
- **Vyper** - Alternative compiler
- **solc-select** - Version management

## Usage

All tools accept `files` arrays containing Solidity file paths. Analysis runs in sandboxed environments with automatic cleanup. See [example-usage.md](example-usage.md) for detailed examples.

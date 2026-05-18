# Slither MCP Server

An MCP (Model Context Protocol) server that provides static analysis capabilities for Solidity smart contracts using [Slither](https://github.com/crytic/slither).

## How it works

The server wraps Slither static analysis functionality, making it accessible through the Model Context Protocol. It can analyze Solidity projects (Foundry, Hardhat, etc.) and cache results for faster subsequent queries.

## Features

- **Caching**: Slither runs are cached for faster subsequent loads
- **Security Analysis**: Run Slither detectors and access results with filtering
- **Contract Analysis**: Get detailed information about contracts, functions, and inheritance
- **Project Support**: Works with Foundry, Hardhat, and other Solidity project types
- **Library Import Support**: Handles external dependencies (OpenZeppelin, etc.) with custom remappings
- **Automatic File Placement**: Smart detection of dependency vs. user files for proper compilation

## Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `analyze_files_with_slither` | Run Slither static analysis on Solidity files | `sources` (required), `remappings` (optional) |
| `run_detectors_with_slither` | Run specific Slither detectors on files | `sources` (required), `detectors` (optional), `remappings` (optional) |
| `get_contract_info_with_slither` | Get detailed information about contracts | `sources` (required), `contract_name` (optional), `remappings` (optional) |

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

### Basic Usage

All tools accept `sources` objects containing file paths as keys and Solidity source code as values. Analysis runs in sandboxed Foundry environments with automatic cleanup.

```json
{
  "sources": {
    "contracts/MyToken.sol": "pragma solidity ^0.8.0; contract MyToken { ... }"
  }
}
```

### Using with External Libraries

When analyzing contracts that import external libraries (like OpenZeppelin), provide both the sources and remappings:

```json
{
  "sources": {
    "contracts/MyToken.sol": "import '@openzeppelin/contracts/token/ERC721/ERC721.sol'; ...",
    "@openzeppelin/contracts@5.6.0/token/ERC721/ERC721.sol": "...",
    "@openzeppelin/contracts@5.6.0/access/Ownable.sol": "..."
  },
  "remappings": [
    "@openzeppelin/contracts/=@openzeppelin/contracts@5.6.0/"
  ]
}
```

See [example-usage.md](example-usage.md) for detailed examples.

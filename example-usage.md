# Slither MCP Docker Usage

## Quick Start

1. **Start the MCP server (includes full security toolbox):**
   ```bash
   docker compose up slither-mcp
   ```

2. **For interactive analysis, start a dedicated shell:**
   ```bash
   docker compose --profile interactive up -d toolbox-shell
   docker compose exec toolbox-shell bash
   ```

3. **Or access the running MCP server container:**
   ```bash
   docker compose exec slither-mcp bash
   ```

## Directory Structure

```
├── artifacts/          # Analysis results and cache
├── docker-compose.yml  # Docker services configuration
└── src/               # MCP server source code
```

**Note:** Files are now provided as content via the API rather than filesystem mounts.

## Usage Examples

### Analyze Files via MCP API

```bash
# Health check
curl http://localhost:9005/health

# Start MCP session and analyze files with content
curl -X POST http://localhost:9005/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "analyze_files",
      "arguments": {
        "files": {
          "MyContract.sol": "pragma solidity ^0.8.0;\n\ncontract MyContract {\n    uint256 public value;\n    \n    function setValue(uint256 _value) public {\n        value = _value;\n    }\n}",
          "Token.sol": "pragma solidity ^0.8.0;\n\nimport \"./MyContract.sol\";\n\ncontract Token is MyContract {\n    mapping(address => uint256) public balances;\n}"
        }
      }
    }
  }'
```

### Interactive Toolbox

```bash
# Access the full security toolbox (same container as MCP server)
docker compose exec slither-mcp bash

# Inside the container, you have access to:
# - slither (used by MCP server)
# - foundry (forge, cast, anvil) 
# - echidna
# - medusa
# - vyper
# - solc-select
# - Node.js and the running MCP server
```

## Available Tools

| MCP Tool | Description |
|----------|-------------|
| `analyze_files` | Run comprehensive Slither analysis on file list |
| `run_detectors` | Run specific security detectors |
| `get_contract_info` | Get contract inheritance and metadata |

## Security Features

- **Sandboxed Analysis**: Files copied to isolated temporary directories
- **Read-only Mounts**: Contract files mounted as read-only
- **User Isolation**: Runs as non-root `ethsec` user
- **Automatic Cleanup**: Temporary analysis directories are cleaned up
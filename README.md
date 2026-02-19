# ethskills MCP Server

An MCP (Model Context Protocol) server that exposes Ethereum development skills from [ethskills.com](https://ethskills.com) as tools for LLMs.

## How it works

On startup the server downloads all skill markdown files from ethskills.com and holds them in memory. Tool calls read directly from the cache — no network requests at query time.

## Tools

| Tool | Description |
|------|-------------|
| `list_skills` | Lists all available skills with their ids and descriptions |
| `get_skill` | Returns the full markdown content for a given skill id |

## Skills

| ID | Name |
|----|------|
| `ship` | Ship |
| `why` | Why Ethereum |
| `gas` | Gas & Costs |
| `wallets` | Wallets |
| `l2s` | Layer 2s |
| `standards` | Standards |
| `tools` | Tools |
| `building-blocks` | Money Legos |
| `orchestration` | Orchestration |
| `addresses` | Contract Addresses |
| `concepts` | Concepts |
| `security` | Security |
| `testing` | Testing |
| `indexing` | Indexing |
| `frontend-ux` | Frontend UX |
| `frontend-playbook` | Frontend Playbook |
| `qa` | QA |

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check — includes `skills_loaded` / `skills_total` counts |
| `POST` | `/mcp` | MCP Streamable HTTP — initialize session or send request |
| `GET` | `/mcp` | MCP SSE stream for an existing session |
| `DELETE` | `/mcp` | Close an existing session |

## Development

```bash
npm install
npm run dev
```

## Production (Docker)

Built and deployed via `docker-compose` in [remix-api](../remix-api), available at `/ethskills` on the gateway.

```bash
docker compose up ethskills --build
```

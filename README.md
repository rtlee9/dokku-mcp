# dokku-mcp

An MCP (Model Context Protocol) server that lets Claude Code manage a remote [Dokku](https://dokku.com/) server over SSH.

## Tools

| Tool | Description |
|------|-------------|
| `dokku_run` | Run any Dokku command (automatically prefixed with `dokku`) |
| `dokku_ssh` | Run an arbitrary shell command on the server |

## Prerequisites

- Node.js >= 18
- SSH access to your Dokku server (key-based auth recommended)

## Setup

```bash
npm install
npm run build
```

Register with Claude Code:

```bash
claude mcp add --transport stdio dokku \
  --env DOKKU_HOST=root@your-server-ip \
  -- node /path/to/dokku-mcp/dist/index.js
```

Restart Claude Code to pick up the new server.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DOKKU_HOST` | Yes | SSH destination, e.g. `root@1.2.3.4` |
| `DOKKU_SSH_OPTIONS` | No | Additional SSH flags, space-separated |

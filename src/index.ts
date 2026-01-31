#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { execFile } from "node:child_process";

if (!process.env.DOKKU_HOST) {
  console.error("DOKKU_HOST environment variable is required (e.g. root@your-server-ip)");
  process.exit(1);
}
const DOKKU_HOST: string = process.env.DOKKU_HOST;
const SSH_OPTIONS = (process.env.DOKKU_SSH_OPTIONS || "").split(/\s+/).filter(Boolean);

function runSSH(command: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const args = [
      ...SSH_OPTIONS,
      "-o", "StrictHostKeyChecking=accept-new",
      DOKKU_HOST,
      command,
    ];

    execFile("ssh", args, { timeout: 30_000 }, (error, stdout, stderr) => {
      if (error) {
        // Still return output even on non-zero exit, as dokku sometimes
        // uses stderr for useful info
        if (stdout || stderr) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`SSH command failed: ${error.message}`));
        }
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

const server = new Server(
  { name: "dokku-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "dokku_run",
      description: `Run a Dokku command on the remote server (${DOKKU_HOST}).

Pass the full dokku command as the 'command' argument.

Examples:
  - "apps:list"
  - "apps:create myapp"
  - "config:show myapp"
  - "ps:scale myapp web=2"
  - "logs myapp --num 100"
  - "domains:report myapp"
  - "proxy:ports myapp"
  - "letsencrypt:enable myapp"
  - "storage:list myapp"
  - "plugin:list"

The command is prefixed with 'dokku' automatically.`,
      inputSchema: {
        type: "object" as const,
        properties: {
          command: {
            type: "string",
            description:
              "The dokku command to run (without the 'dokku' prefix). e.g. 'apps:list' or 'config:show myapp'",
          },
        },
        required: ["command"],
      },
    },
    {
      name: "dokku_ssh",
      description: `Run an arbitrary shell command on the Dokku server (${DOKKU_HOST}).

Use this for non-dokku operations like checking disk space, viewing files, managing services, etc.

Examples:
  - "df -h"
  - "docker ps"
  - "cat /home/dokku/myapp/ENV"
  - "systemctl status dokku-daemon"`,
      inputSchema: {
        type: "object" as const,
        properties: {
          command: {
            type: "string",
            description: "The shell command to run on the remote server.",
          },
        },
        required: ["command"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "dokku_run") {
    const command = args?.command as string;
    if (!command) {
      return {
        content: [{ type: "text", text: "Error: 'command' argument is required" }],
        isError: true,
      };
    }

    try {
      const { stdout, stderr } = await runSSH(`dokku ${command}`);
      const output = [stdout, stderr].filter(Boolean).join("\n---stderr---\n");
      return {
        content: [{ type: "text", text: output || "(no output)" }],
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: `Error: ${message}` }],
        isError: true,
      };
    }
  }

  if (name === "dokku_ssh") {
    const command = args?.command as string;
    if (!command) {
      return {
        content: [{ type: "text", text: "Error: 'command' argument is required" }],
        isError: true,
      };
    }

    try {
      const { stdout, stderr } = await runSSH(command);
      const output = [stdout, stderr].filter(Boolean).join("\n---stderr---\n");
      return {
        content: [{ type: "text", text: output || "(no output)" }],
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: `Error: ${message}` }],
        isError: true,
      };
    }
  }

  return {
    content: [{ type: "text", text: `Unknown tool: ${name}` }],
    isError: true,
  };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

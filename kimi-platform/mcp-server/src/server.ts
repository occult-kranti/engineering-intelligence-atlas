/**
 * MCP server assembly. Pure wiring: config + http client + sanitizer + tools.
 * Transport-agnostic so tests can attach an in-memory transport.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CompanionHttpClient } from './client/http.js';
import type { ServerConfig } from './config.js';
import { Sanitizer } from './sanitize.js';
import { registerAssistantTools } from './tools/assistant.js';
import type { ToolContext } from './tools/common.js';
import { registerReadTools } from './tools/read.js';
import { registerWriteTools } from './tools/write.js';

export const SERVER_NAME = 'research-director-mcp';
export const SERVER_VERSION = '0.1.0';

export interface BuildServerOptions {
  /** Test hook: override the fetch implementation used by the HTTP client. */
  fetchImpl?: typeof fetch;
}

export function buildServer(config: ServerConfig, opts: BuildServerOptions = {}): McpServer {
  const sanitizer = new Sanitizer(config.token);
  const http = new CompanionHttpClient({
    baseUrl: config.baseUrl,
    token: config.token,
    timeoutMs: config.requestTimeoutMs,
    maxResponseBytes: config.maxResponseBytes,
    sanitizer,
    ...(opts.fetchImpl !== undefined ? { fetchImpl: opts.fetchImpl } : {}),
  });
  const ctx: ToolContext = { config, http, sanitizer };

  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions:
        'Bridge to the Research Director desktop companion (loopback, token-authenticated). ' +
        'Read tools are always available. Write tools require the server to be started with ' +
        '--enable-writes and each call to pass confirmed:true after explicit user approval. ' +
        'Provider-paid chat sends additionally require --enable-provider-writes. ' +
        'Enterprise/Donna/repository tools depend on desktop companion routes; when a route is ' +
        'unavailable the tool returns capability_unavailable — never invent that data.',
    },
  );

  registerReadTools(server, ctx);
  registerWriteTools(server, ctx);
  registerAssistantTools(server, ctx);
  return server;
}

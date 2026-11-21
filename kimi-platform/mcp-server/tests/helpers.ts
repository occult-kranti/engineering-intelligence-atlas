/**
 * Test harness: a mock desktop companion (faithful to bridgeVersion 4
 * semantics: bearer auth, JSON bodies, 404 sentinel 'not found') and an
 * in-memory MCP client wired through the official SDK transports.
 */

import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { parseConfig } from '../src/config.js';
import { buildServer } from '../src/server.js';

export const TEST_TOKEN = 'test-pairing-token-0123456789abcdef';

export interface MockCompanion {
  url: string;
  requests: Array<{ method: string; path: string; authorization: string | null; body: unknown }>;
  close: () => Promise<void>;
}

type Handler = (
  body: unknown,
  query: URLSearchParams,
) => { status: number; json: unknown } | undefined;

/**
 * Minimal v4-faithful companion. Unknown routes answer exactly like the real
 * server: 404 { ok:false, error:'not found' } (the capability sentinel).
 */
export async function startMockCompanion(routes: Record<string, Handler>, opts: { token?: string } = {}): Promise<MockCompanion> {
  const token = opts.token ?? TEST_TOKEN;
  const requests: MockCompanion['requests'] = [];

  const server = http.createServer((req, res) => {
    const send = (status: number, json: unknown) => {
      const payload = JSON.stringify(json);
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(payload);
    };
    const auth = req.headers.authorization ?? null;
    if (auth !== `Bearer ${token}`) {
      requests.push({ method: req.method ?? '', path: req.url ?? '', authorization: auth, body: null });
      send(401, { ok: false, error: 'unauthorized' });
      return;
    }
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const key = `${req.method} ${url.pathname}`;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      let body: unknown = null;
      if (chunks.length > 0) {
        try {
          body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        } catch {
          body = null;
        }
      }
      requests.push({ method: req.method ?? '', path: url.pathname + url.search, authorization: auth, body });
      const handler = routes[key];
      const out = handler?.(body, url.searchParams);
      if (out === undefined) {
        send(404, { ok: false, error: 'not found' });
        return;
      }
      send(out.status, out.json);
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections?.();
        server.close(() => resolve());
      }),
  };
}

export interface Harness {
  server: McpServer;
  client: Client;
  close: () => Promise<void>;
}

export interface HarnessEnv {
  token?: string | undefined;
  baseUrl: string;
  enableWrites?: boolean;
  enableProviderWrites?: boolean;
  toolOutputMaxChars?: number;
  maxResponseBytes?: number;
}

export async function makeHarness(env: HarnessEnv): Promise<Harness> {
  const argv: string[] = [];
  if (env.enableWrites) argv.push('--enable-writes');
  if (env.enableProviderWrites) argv.push('--enable-provider-writes');
  const config = parseConfig(argv, {
    RESEARCH_DIRECTOR_PAIRING_TOKEN: env.token,
    RESEARCH_DIRECTOR_COMPANION_URL: env.baseUrl,
  } as NodeJS.ProcessEnv);
  if (env.toolOutputMaxChars !== undefined) config.toolOutputMaxChars = env.toolOutputMaxChars;
  if (env.maxResponseBytes !== undefined) config.maxResponseBytes = env.maxResponseBytes;

  const server = buildServer(config);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return {
    server,
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

export interface ParsedToolResult {
  isError: boolean;
  structured: Record<string, unknown>;
  text: string;
}

export async function callTool(client: Client, name: string, args: Record<string, unknown> = {}): Promise<ParsedToolResult> {
  const result = await client.callTool({ name, arguments: args });
  const text = Array.isArray(result.content) && result.content[0]?.type === 'text' ? (result.content[0].text as string) : '';
  const structured = (result.structuredContent ?? {}) as Record<string, unknown>;
  return { isError: result.isError === true, structured, text };
}

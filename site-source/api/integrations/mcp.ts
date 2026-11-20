import { ConnectorError } from "./connectors";
import { makeGuardedFetch } from "./http";

/**
 * Remote MCP (Model Context Protocol) discovery — Streamable HTTP only.
 *
 * Scope, strictly:
 *  - protocol `initialize` + `tools/list` via the official
 *    @modelcontextprotocol/sdk Client;
 *  - NEVER tools/call (this module contains no call path — the Client
 *    instance is created, queried for its tool list, and closed);
 *  - no STDIO, no subprocess, no local command execution of any kind;
 *  - HTTPS with DNS pinning / private-IP / redirect blocking inherited from
 *    the guarded fetch; the exact server host is allowlisted per request;
 *  - the caller (router) additionally enforces the owner's MCP allowlist.
 *
 * Discovered tool schemas are untrusted input — the router stores them as
 * quarantined discovery records with content hashes.
 */

const MCP_TOOL_CAP = 200;
const MCP_TIMEOUT_MS = 20_000;

export interface McpDiscoveredTool {
  name: string;
  description: string;
  /** Raw JSON schema — untrusted, stored quarantined, never executed. */
  inputSchema: Record<string, unknown>;
}

export async function mcpDiscoverTools(
  url: string,
  bearer: string | null,
): Promise<{ tools: McpDiscoveredTool[]; serverInfo: { name: string; version: string } }> {
  const host = new URL(url).hostname.toLowerCase();
  const guardedFetch = makeGuardedFetch({
    allowHosts: [host],
    timeoutMs: MCP_TIMEOUT_MS,
    maxBytes: 2 * 1024 * 1024,
  });

  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
  const { StreamableHTTPClientTransport } = await import(
    "@modelcontextprotocol/sdk/client/streamableHttp.js"
  );

  const transport = new StreamableHTTPClientTransport(new URL(url), {
    fetch: guardedFetch,
    requestInit: {
      headers: bearer ? { authorization: `Bearer ${bearer}` } : {},
    },
  });
  const client = new Client(
    { name: "engineering-intelligence-atlas", version: "1.0.0" },
    { capabilities: {} },
  );

  try {
    // connect() performs the MCP initialize handshake. listTools() issues a
    // single tools/list. There is deliberately no callTool anywhere.
    await client.connect(transport);
    const result = await client.listTools();
    const serverInfo = client.getServerVersion() ?? { name: "", version: "" };
    const tools: McpDiscoveredTool[] = (result.tools ?? [])
      .slice(0, MCP_TOOL_CAP)
      .map((t) => ({
        name: String(t.name ?? "").slice(0, 255),
        description: String(t.description ?? "").slice(0, 2_000),
        inputSchema:
          t.inputSchema && typeof t.inputSchema === "object"
            ? (t.inputSchema as Record<string, unknown>)
            : {},
      }));
    return {
      tools,
      serverInfo: {
        name: String(serverInfo.name ?? "").slice(0, 255),
        version: String(serverInfo.version ?? "").slice(0, 100),
      },
    };
  } catch (err) {
    // Classify without leaking: never include response bodies or headers.
    const status = (err as { code?: number })?.code;
    if (typeof status === "number") {
      throw new ConnectorError(
        status === 401 || status === 403 ? "auth" : status >= 500 ? "unreachable" : "bad_response",
        `MCP server returned HTTP ${status}`,
      );
    }
    const name = (err as Error)?.name ?? "";
    if (name === "BlockedUrlError") throw err;
    if (/timeout|abort/i.test(name) || /timed out/i.test((err as Error)?.message ?? "")) {
      throw new ConnectorError("unreachable", "MCP server did not respond in time");
    }
    throw new ConnectorError("bad_response", "MCP handshake/discovery failed");
  } finally {
    try {
      await client.close();
    } catch {
      // best-effort cleanup
    }
  }
}

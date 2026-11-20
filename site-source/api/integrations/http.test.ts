import { describe, expect, it, beforeAll, afterAll } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";

/**
 * SSRF / redirect / private-IP / cap enforcement tests for the guarded HTTP
 * layer. Uses a real loopback mock server (allowed only because NODE_ENV is
 * not production and INTEGRATIONS_ALLOW_LOCAL_HTTP=1); every private/blocked
 * case is asserted to be refused BEFORE any socket opens.
 */

process.env.INTEGRATIONS_ALLOW_LOCAL_HTTP = "1";

const {
  BlockedUrlError,
  ConnectorTimeoutError,
  ResponseTooLargeError,
  guardedJson,
  guardedRequest,
  isPrivateIp,
  localHttpAllowed,
} = await import("./http");

let server: http.Server;
let base: string;
let lastRequest: { method: string; url: string; headers: http.IncomingHttpHeaders } | null = null;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    lastRequest = { method: req.method ?? "", url: req.url ?? "", headers: req.headers };
    if (req.url === "/json") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    } else if (req.url === "/redirect-metadata") {
      res.writeHead(302, { location: "http://169.254.169.254/latest/meta-data" });
      res.end();
    } else if (req.url === "/redirect-loop") {
      res.writeHead(302, { location: `${base}/redirect-loop` });
      res.end();
    } else if (req.url === "/redirect-ok") {
      res.writeHead(302, { location: `${base}/json` });
      res.end();
    } else if (req.url === "/big") {
      res.writeHead(200, { "content-type": "application/octet-stream" });
      res.end(Buffer.alloc(2 * 1024 * 1024, 1));
    } else if (req.url === "/hang") {
      // never responds
      return;
    } else {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((r) => server.close(r));
});

describe("SSRF policy", () => {
  it("blocks plaintext http to non-loopback hosts", async () => {
    await expect(guardedJson("http://example.com/")).rejects.toThrow(BlockedUrlError);
  });

  it("blocks non-http(s) schemes", async () => {
    await expect(guardedRequest("file:///etc/passwd")).rejects.toThrow(BlockedUrlError);
    await expect(guardedRequest("ftp://127.0.0.1/")).rejects.toThrow(BlockedUrlError);
  });

  it("blocks link-local/cloud-metadata IPs", async () => {
    await expect(guardedRequest("https://169.254.169.254/latest/meta-data")).rejects.toThrow(
      BlockedUrlError,
    );
  });

  it("loopback https is refused at the socket when nothing listens (policy allows loopback only in dev mode)", async () => {
    // Dev mode permits loopback targets so local mock servers work; nothing
    // listens on this port, so the connection must fail — not hang.
    await expect(guardedRequest("https://127.0.0.1:1/")).rejects.toThrow();
  });

  it("blocks private-range literal IPs", () => {
    for (const ip of [
      "10.0.0.1",
      "172.16.0.1",
      "192.168.1.1",
      "127.0.0.1",
      "169.254.1.1",
      "100.64.0.1",
      "0.0.0.0",
      "224.0.0.1",
      "::1",
      "fd00::1",
      "fe80::1",
      "::ffff:127.0.0.1",
    ]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
    expect(isPrivateIp("8.8.8.8")).toBe(false);
  });

  it("blocks private DNS names when dev loopback mode is off", async () => {
    const saved = process.env.INTEGRATIONS_ALLOW_LOCAL_HTTP;
    delete process.env.INTEGRATIONS_ALLOW_LOCAL_HTTP;
    try {
      await expect(guardedRequest("https://localhost:1/")).rejects.toThrow(BlockedUrlError);
      await expect(guardedRequest("https://127.0.0.1:1/")).rejects.toThrow(BlockedUrlError);
    } finally {
      process.env.INTEGRATIONS_ALLOW_LOCAL_HTTP = saved;
    }
  });

  it("blocks .internal/.local style hostnames", async () => {
    await expect(guardedRequest("https://metadata.google.internal/")).rejects.toThrow(
      BlockedUrlError,
    );
  });

  it("blocks URLs with embedded credentials", async () => {
    await expect(guardedRequest("https://user:pass@example.com/")).rejects.toThrow(
      BlockedUrlError,
    );
  });

  it("enforces exact host allowlists", async () => {
    await expect(
      guardedRequest("https://evil.example/", { allowHosts: ["api.github.com"] }),
    ).rejects.toThrow(BlockedUrlError);
  });

  it("blocks redirects to private/blocked targets (re-validated per hop)", async () => {
    await expect(guardedRequest(`${base}/redirect-metadata`)).rejects.toThrow(BlockedUrlError);
  });

  it("caps redirect depth", async () => {
    await expect(guardedRequest(`${base}/redirect-loop`)).rejects.toThrow(BlockedUrlError);
  });

  it("follows a same-host loopback redirect only in explicit dev mode", async () => {
    expect(localHttpAllowed()).toBe(true);
    const res = await guardedRequest(`${base}/redirect-ok`);
    expect(res.status).toBe(200);
  });
});

describe("response caps and timeouts", () => {
  it("enforces the response byte cap", async () => {
    await expect(guardedRequest(`${base}/big`, { maxBytes: 1024 })).rejects.toThrow(
      ResponseTooLargeError,
    );
  });

  it("enforces the request timeout", async () => {
    await expect(guardedRequest(`${base}/hang`, { timeoutMs: 200 })).rejects.toThrow(
      ConnectorTimeoutError,
    );
  });

  it("performs a normal JSON request against the loopback mock", async () => {
    const res = await guardedJson<{ ok: boolean }>(`${base}/json`, { timeoutMs: 2000 });
    expect(res.status).toBe(200);
    expect(res.json.ok).toBe(true);
    expect(lastRequest?.method).toBe("GET");
  });
});

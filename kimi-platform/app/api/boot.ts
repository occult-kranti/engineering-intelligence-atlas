import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";
import { createOAuthCallbackHandler } from "./kimi/auth";
import { Paths } from "@contracts/constants";
import { log } from "./lib/logger";
import { handleClientLog } from "./lib/clientlog";
import { REQUEST_ID_HEADER, runWithRequestId } from "./lib/requestcontext";

const app = new Hono<{ Bindings: HttpBindings }>();

// One middleware for both halves of request observability, because they need the
// same scope and the same id:
//   - G3 correlation: mint a request id, echo it on the response header (what the
//     browser logger reads), and run the rest of the request inside it so every
//     server log line carries it.
//   - G4 access log: one line per request with method/path/status/duration, so
//     "who called what and how long did it take" is answerable. Until now only
//     failures were logged at all, and success left no trace.
// /api/log is skipped: it is the browser's log sink, and an access line per
// POSTed batch would be self-amplifying noise in the very file it writes.
app.use("*", async (c, next) => {
  const requestId = crypto.randomUUID();
  if (c.req.path === "/api/log") {
    await next();
    return;
  }
  const start = Date.now();
  await runWithRequestId(requestId, async () => {
    await next();
    // Set the header AFTER next(): the tRPC route hands Hono a raw Response
    // built by fetchRequestHandler, which carries its own headers, so a
    // c.header() called before dispatch is dropped on that path. Setting it on
    // the resolved c.res covers every route, including the tRPC one.
    c.res.headers.set(REQUEST_ID_HEADER, requestId);
    // Only /api/* is logged. In production serveStaticFiles() registers a
    // catch-all AFTER this middleware, so a page load pulls in every asset as
    // its own request — logging those would bury the API calls the agent reads
    // this file for, and inflate the log for no diagnostic gain.
    if (!c.req.path.startsWith("/api/")) return;
    log.info("request", {
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs: Date.now() - start,
    });
  });
});

// Scoped to the tRPC route, NOT global: on the dev server (@hono/vite-dev-server)
// a global bodyLimit breaks bodyless requests. Hono's bodyLimit reads any truthy
// request stream to the end and then rebuilds the Request with `new Request(raw,
// { body, duplex: "half" })`; the dev server's Response/Request class makes that
// rebuild throw `TypeError: Cannot read private member #state ...`, so every
// bodyless request (DELETE/PATCH on the app's own REST routes) 500s at dispatch.
// /api/log keeps its own 64KB caps in lib/clientlog.ts, so it needs no middleware.
app.use("/api/trpc/*", bodyLimit({ maxSize: 50 * 1024 * 1024 }));
app.get(Paths.oauthCallback, createOAuthCallbackHandler());
app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});
// Browser-side log sink (see lib/clientlog.ts). Must be registered before the
// /api/* 404 catch-all below. bodyLimit guards it too: lib/clientlog.ts caps the
// body itself, but only AFTER Hono has read it into memory, and this route sits
// on the public preview URL — the cap has to bite before the read.
app.post(
  "/api/log",
  bodyLimit({ maxSize: 64 * 1024, onError: (c) => c.body(null, 413) }),
  handleClientLog,
);
// Plain REST export download (spec §9.3, §5.1 note): the only product REST
// route besides /api/log. Owner-checks the export row, then redirects to a
// freshly minted presigned URL — keys are persisted, URLs never are.
// Registered above the /api/* 404 catch-all.
app.get("/api/exports/:id/download", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: "Bad Request" }, 400);
  }
  const { authenticateRequest } = await import("./kimi/auth");
  let user;
  try {
    user = await authenticateRequest(c.req.raw.headers);
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const { getDb } = await import("./queries/connection");
  const { exportsTable, projects } = await import("@db/schema");
  const { eq } = await import("drizzle-orm");
  const db = getDb();
  const ex = await db.query.exportsTable.findFirst({
    where: eq(exportsTable.id, id),
  });
  if (!ex) return c.json({ error: "Not Found" }, 404);
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, ex.projectId),
  });
  if (!project || project.ownerId !== user.id) {
    return c.json({ error: "Not Found" }, 404);
  }
  if (!ex.storageKey) {
    return c.json(
      {
        error: "export has no stored file",
        code: ex.storageError ?? "STORAGE_NOT_PROVISIONED",
      },
      412,
    );
  }
  const { storage } = await import("./lib/storage");
  const { url } = await storage.getPresignedUrl({ key: ex.storageKey, download: true });
  return c.redirect(url, 302);
});
app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

// Unhandled request errors must reach /tmp/kimi-logs/app.log, not just stdout:
// that file is what the building agent reads when a preview 500s, and without
// this the log looks clean while the request actually failed. Response stays a
// generic 500 (no stack leaked to the caller); the detail goes to the log only.
app.onError((err, c) => {
  log.error("unhandled request error", {
    method: c.req.method,
    path: c.req.path,
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  return c.json({ error: "Internal Server Error" }, 500);
});

export default app;

// ── Control-plane advancement triggers (doc §9.4.4) ──────────────
// Queries never advance runs. Advancement comes from (a) mutations, and
// (b) this startup sweep + unref'd interval: one lease sweep plus one
// bounded advance pass over active runs. No busy waiting. Disabled under
// tests and when CONTROL_PLANE_INTERVAL_MS=off / 0.
{
  const raw = process.env.CONTROL_PLANE_INTERVAL_MS;
  const disabled =
    process.env.VITEST === "true" || raw === "off" || raw === "0";
  const intervalMs = raw && !disabled ? Math.max(5_000, Number(raw) || 15_000) : 15_000;
  if (!disabled && env.databaseUrl) {
    const tick = async () => {
      try {
        const { sweepAndAdvanceOnce } = await import("./engine/scheduler");
        await sweepAndAdvanceOnce();
      } catch (err) {
        log.error("control-plane sweep failed", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    };
    void tick(); // startup sweep: restart recovery for unwatched runs
    const timer = setInterval(() => void tick(), intervalMs);
    timer.unref(); // never keep the process alive for the sweeper
  }
}

if (env.isProduction) {
  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");
  serveStaticFiles(app);

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    log.info(`Server running on http://localhost:${port}/`);
  });
}

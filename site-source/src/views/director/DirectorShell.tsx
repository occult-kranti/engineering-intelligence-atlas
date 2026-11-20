import { useState } from "react";
import { trpc } from "@/lib/trpc-client";
import Login from "@/pages/Login";
import Projects from "./Projects";
import GraphEditor from "./GraphEditor";
import RunConsole from "./RunConsole";
import IntegrationsPanel from "./Integrations";
import { ApprovalsPanel, SettingsPanel, SkillsPanel } from "./Panels";

/**
 * Director runtime shell. All authenticated states are handled honestly:
 * loading skeleton → grafted Kimi Login page → API-down banner → views.
 * The public atlas never depends on this chunk (lazy-loaded from App).
 */

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="mb-4 border border-[hsl(var(--mustard))] bg-[hsl(var(--paper-raised))] p-3 text-sm" role="alert">
      <span className="font-bold">Director runtime notice:</span> {message}
    </div>
  );
}

export default function DirectorShell({ path }: { path: string }) {
  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => window.location.reload(),
  });
  const [showLogin, setShowLogin] = useState(false);

  if (path === "login") {
    return <Login />;
  }
  if (me.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-[hsl(var(--ink-soft))]">
        Checking session…
      </div>
    );
  }
  if (me.error || !me.data) {
    if (showLogin) return <Login />;
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <h1 className="text-2xl font-extrabold tracking-tight">Research Director</h1>
        <p className="prose-evidence mt-3 text-sm text-[hsl(var(--ink-soft))]">
          The Director is the authenticated multi-agent workspace for this atlas.
          Sign in with the site’s Kimi OAuth to manage projects, plans, and runs.
          The public atlas remains available without sign-in.
        </p>
        {me.error ? (
          <ErrorNote
            message={`the Director API did not return a session (${me.error.message}). If the API is down, the public atlas still works — use the chapter navigation after signing in later.`}
          />
        ) : null}
        <div className="mt-5 flex gap-3">
          <button type="button" className="tab-control" onClick={() => setShowLogin(true)}>
            Sign in
          </button>
          <a className="tab-control inline-block" href="#/overview">
            Back to atlas
          </a>
        </div>
      </div>
    );
  }

  const parts = path.split("/").filter(Boolean); // director/...
  let body: React.ReactNode;
  if (parts.length === 1) {
    body = <Projects />;
  } else if (parts[1] === "skills") {
    body = <SkillsPanel />;
  } else if (parts[1] === "approvals") {
    body = <ApprovalsPanel />;
  } else if (parts[1] === "settings") {
    body = <SettingsPanel />;
  } else if (parts[1] === "integrations") {
    body = <IntegrationsPanel />;
  } else if (parts[1] === "projects" && parts[2] && parts[3] === "graph") {
    body = <GraphEditor projectId={Number(parts[2])} />;
  } else if (parts[1] === "projects" && parts[2] && parts[3] === "runs" && parts[4]) {
    body = <RunConsole runId={Number(parts[4])} projectId={Number(parts[2])} />;
  } else if (parts[1] === "projects" && parts[2]) {
    body = <Projects focusId={Number(parts[2])} />;
  } else {
    body = <Projects />;
  }

  const tabs: [string, string][] = [
    ["Projects", "#/director"],
    ["Skill registry", "#/director/skills"],
    ["Approvals", "#/director/approvals"],
    ["Integrations", "#/director/integrations"],
    ["Settings", "#/director/settings"],
  ];
  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center gap-2 border-b border-[hsl(var(--line))] px-4 py-3">
        <a href="#/overview" className="text-sm font-extrabold tracking-tight">
          ← Atlas
        </a>
        <span className="text-sm font-extrabold tracking-tight">/ Director</span>
        <nav className="ml-2 flex flex-wrap gap-1" aria-label="Director sections">
          {tabs.map(([label, hash]) => (
            <a key={hash} href={hash} className="tab-control text-xs">
              {label}
            </a>
          ))}
        </nav>
        <span className="ml-auto text-xs text-[hsl(var(--ink-soft))]">
          {me.data.name ?? me.data.email ?? "owner"}
        </span>
        <button
          type="button"
          className="tab-control text-xs"
          onClick={() => logout.mutate()}
        >
          Sign out
        </button>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{body}</main>
    </div>
  );
}

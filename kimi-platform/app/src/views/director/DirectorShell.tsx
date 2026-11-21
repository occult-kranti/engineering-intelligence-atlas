import { lazy, Suspense, useState } from "react";
import { trpc } from "@/lib/trpc-client";
import Login from "@/pages/Login";
import DirectorHome from "./DirectorHome";
import GlobalApprovals from "./GlobalApprovals";
import { SettingsPanel, SkillsPanel } from "./Panels";
import { usePendingApprovalCount } from "./workspace/useWorkspaceData";
import type { StageId } from "./workspace/adapter";

/**
 * Director runtime shell: auth gate + route dispatch.
 * States are honest: loading skeleton → signed-out workspace preview (the
 * grafted Kimi Login page is unchanged) → API-down notice → views.
 * The public atlas never depends on this chunk (lazy-loaded from App);
 * the workspace, graph editor, run console, and integrations panel are
 * further lazy chunks so the Director entry stays small.
 */

const WorkspaceShell = lazy(() => import("./workspace/WorkspaceShell"));
const IntegrationsPanel = lazy(() => import("./Integrations"));

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
      <div className="flex min-h-screen items-center justify-center text-sm text-[hsl(var(--ink-soft))]" role="status">
        Checking session…
      </div>
    );
  }
  if (me.error || !me.data) {
    if (showLogin) return <Login />;
    return <SignedOutPreview apiError={me.error?.message ?? null} onSignIn={() => setShowLogin(true)} />;
  }

  const parts = path.split("/").filter(Boolean); // director/...
  const user = me.data;
  const onSignOut = () => logout.mutate();

  // Project workspace (the primary surface). Old deep links land here:
  // …/graph → roadmap stage; …/runs[/:runId] → control stage.
  if (parts[1] === "projects" && parts[2]) {
    const projectId = Number(parts[2]);
    if (Number.isFinite(projectId)) {
      const focusRunId =
        parts[3] === "runs" && parts[4] && Number.isFinite(Number(parts[4]))
          ? Number(parts[4])
          : undefined;
      const initialStage: StageId =
        parts[3] === "runs" ? "control" : parts[3] === "graph" ? "roadmap" : "roadmap";
      return (
        <Suspense fallback={<WorkspaceFallback />}>
          <WorkspaceShell
            projectId={projectId}
            focusRunId={focusRunId}
            initialStage={initialStage}
            user={user}
            onSignOut={onSignOut}
          />
        </Suspense>
      );
    }
  }

  // Secondary surfaces keep a light page chrome; the workspace owns the flow.
  let section = "Projects";
  let body: React.ReactNode;
  if (parts.length === 1) {
    body = <DirectorHome />;
  } else if (parts[1] === "skills") {
    section = "Skill registry";
    body = <SkillsPanel />;
  } else if (parts[1] === "approvals") {
    section = "Approvals";
    body = <GlobalApprovals />;
  } else if (parts[1] === "settings") {
    section = "Settings";
    body = <SettingsPanel />;
  } else if (parts[1] === "integrations") {
    section = "Integrations";
    body = (
      <Suspense fallback={<p className="text-sm text-[hsl(var(--ink-soft))]" role="status">Loading integrations…</p>}>
        <IntegrationsPanel />
      </Suspense>
    );
  } else {
    body = <DirectorHome />;
  }

  return (
    <div className="min-h-screen">
      <PageChrome section={section} user={user} onSignOut={onSignOut} />
      <main id="main" className="mx-auto max-w-6xl px-4 py-6">
        {body}
      </main>
    </div>
  );
}

function WorkspaceFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-[hsl(var(--ink-soft))]" role="status">
      Loading workspace…
    </div>
  );
}

/** Light chrome for home/secondary pages: atlas link, approvals pill, sign-out. */
function PageChrome({
  section,
  user,
  onSignOut,
}: {
  section: string;
  user: { name?: string | null; email?: string | null };
  onSignOut(): void;
}) {
  const approvals = usePendingApprovalCount();
  return (
    <header className="flex flex-wrap items-center gap-2 border-b border-[hsl(var(--line))] px-4 py-3">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-[hsl(var(--ink))] focus:px-4 focus:py-3 focus:text-sm focus:font-bold focus:text-[hsl(var(--paper))]"
      >
        Skip to main content
      </a>
      <a href="#/overview" className="text-sm font-extrabold tracking-tight">
        ← Atlas
      </a>
      <span className="text-sm font-extrabold tracking-tight">
        / <a href="#/director" className="hover:underline">Director</a>
        {section !== "Projects" ? ` / ${section}` : ""}
      </span>
      <span className="ml-auto flex items-center gap-2">
        <a
          href="#/director/approvals"
          className={`chip ${approvals.status === "live" && approvals.data ? "chip-mustard" : ""} font-bold`}
        >
          ⚠ {approvals.status === "live" ? approvals.data : "—"} approvals
        </a>
        <span className="text-xs text-[hsl(var(--ink-soft))]">
          {user.name ?? user.email ?? "owner"}
        </span>
        <button type="button" className="btn min-h-[36px] px-2 text-xs" onClick={onSignOut}>
          Sign out
        </button>
      </span>
    </header>
  );
}

/**
 * Signed-out: the honest explanation rendered inside a dimmed, non-
 * interactive preview of the workspace layout — the user sees what the
 * Director is before authenticating, and the page stops looking like a
 * login screen. The actual Login page is untouched.
 */
function SignedOutPreview({
  apiError,
  onSignIn,
}: {
  apiError: string | null;
  onSignIn(): void;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center gap-3 border-b border-[hsl(var(--line))] px-4 py-3">
        <span
          aria-hidden
          className="flex h-7 w-7 items-center justify-center bg-[hsl(var(--dark))] text-sm font-extrabold text-[hsl(42_78%_55%)]"
        >
          ▽
        </span>
        <span className="text-sm font-extrabold tracking-tight">Atlas / Director</span>
        <span className="chip ml-auto">signed out</span>
      </header>

      {/* Dimmed structural preview of the five zones */}
      <div aria-hidden className="pointer-events-none grid flex-1 select-none grid-cols-1 gap-px bg-[hsl(var(--line))] opacity-45 md:grid-cols-[240px_1fr_280px]">
        <div className="bg-[hsl(var(--paper))] p-4">
          <div className="h-3 w-16 bg-[hsl(var(--line))]" />
          <div className="mt-3 h-16 bg-[hsl(var(--paper-raised))]" />
          {["01 Goal", "02 Roadmap & squad", "03 Task queue", "04 Live control", "05 Artifacts"].map((s) => (
            <div key={s} className="mt-2 border-b border-[hsl(var(--line))] pb-2 text-xs text-[hsl(var(--ink-soft))]">
              {s}
            </div>
          ))}
        </div>
        <div className="bg-[hsl(var(--paper))] p-4">
          <div className="h-4 w-40 bg-[hsl(var(--line))]" />
          <div className="mt-3 h-48 border border-dashed border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))]" />
        </div>
        <div className="bg-[hsl(var(--paper))] p-4">
          <div className="h-3 w-24 bg-[hsl(var(--line))]" />
          <div className="mt-3 h-24 bg-[hsl(var(--paper-raised))]" />
          <div className="mt-2 h-24 bg-[hsl(var(--paper-raised))]" />
        </div>
      </div>

      {/* The sign-in card floats over the preview */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div className="max-w-xl border border-[hsl(var(--line))] bg-[hsl(var(--paper))] p-6 shadow-xl">
          <h1 className="text-2xl font-extrabold tracking-tight">Research Director</h1>
          <p className="prose-evidence mt-3 text-sm text-[hsl(var(--ink-soft))]">
            The Director is the authenticated multi-agent workspace for this
            atlas — goal → roadmap &amp; squad → task queue → live control →
            artifacts. Sign in with the site’s Kimi OAuth to manage projects,
            plans, and runs. The public atlas remains available without
            sign-in.
          </p>
          {apiError ? (
            <ErrorNote
              message={`the Director API did not return a session (${apiError}). If the API is down, the public atlas still works — use the chapter navigation after signing in later.`}
            />
          ) : null}
          <div className="mt-5 flex gap-3">
            <button type="button" className="btn border-[hsl(var(--ink))] font-bold" onClick={onSignIn}>
              Sign in
            </button>
            <a className="btn" href="#/overview">
              Back to atlas
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

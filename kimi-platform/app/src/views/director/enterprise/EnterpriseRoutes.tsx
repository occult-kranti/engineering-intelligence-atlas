import { lazy, Suspense } from "react";
import { trpc } from "@/lib/trpc-client";
import "./enterprise.css";

/**
 * CEO enterprise routes, dispatched from App.tsx (kept out of the main
 * DirectorShell chunk): #/director/enterprises → list/create, and
 * #/director/enterprises/:id → the detail dashboard. Both are further lazy
 * chunks; the heavy graph loads only inside the detail view.
 * Auth mirrors the Director shell: session check → honest signed-out card.
 */

const EnterpriseList = lazy(() => import("./EnterpriseList"));
const EnterpriseDetail = lazy(() => import("./EnterpriseDetail"));

export default function EnterpriseRoutes({ path }: { path: string }) {
  const me = trpc.auth.me.useQuery(undefined, { retry: false });

  if (me.isLoading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center text-sm text-[hsl(var(--ink-soft))]"
        role="status"
      >
        Checking session…
      </div>
    );
  }
  if (me.error || !me.data) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="max-w-md border border-[hsl(var(--line))] bg-[hsl(var(--paper))] p-6">
          <h1 className="text-xl font-extrabold tracking-tight">CEO dashboard — sign in required</h1>
          <p className="prose-evidence mt-2 text-sm text-[hsl(var(--ink-soft))]">
            Enterprises are owner-scoped: companies, departments, contracts,
            and budgets only load for the signed-in owner.
            {me.error ? ` The session check failed (${me.error.message}).` : ""}
          </p>
          <div className="mt-4 flex gap-2">
            <a className="btn border-[hsl(var(--ink))] text-[13px] font-bold" href="#/login">
              Sign in
            </a>
            <a className="btn text-[13px]" href="#/director">
              Director home
            </a>
          </div>
        </div>
      </div>
    );
  }

  const parts = path.split("/").filter(Boolean); // director/enterprises[/:id]
  const idPart = parts[2];
  const enterpriseId = idPart && Number.isFinite(Number(idPart)) ? Number(idPart) : null;

  return (
    <div className="min-h-screen">
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
          {" / "}
          <a href="#/director/enterprises" className="hover:underline">
            Enterprises
          </a>
          {enterpriseId !== null ? ` / #${enterpriseId}` : ""}
        </span>
        <span className="ml-auto text-xs text-[hsl(var(--ink-soft))]">CEO mode</span>
      </header>
      <main id="main" className="ent mx-auto max-w-7xl px-4 py-6">
        <Suspense
          fallback={
            <div className="text-sm text-[hsl(var(--ink-soft))]" role="status">
              Loading enterprise view…
            </div>
          }
        >
          {enterpriseId === null ? (
            <EnterpriseList />
          ) : (
            <EnterpriseDetail enterpriseId={enterpriseId} />
          )}
        </Suspense>
      </main>
    </div>
  );
}

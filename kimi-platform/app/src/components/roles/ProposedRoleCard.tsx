import { PROPOSED_ROLE } from '@/data/roleMatrix';

/**
 * Proposed (not-yet-standing) role candidate surfaced by the capability/depth
 * audit. Rendered outside the 109-role directory so the count is never
 * silently inflated.
 */
export function ProposedRoleCard() {
  const p = PROPOSED_ROLE;
  return (
    <section
      aria-labelledby="proposed-role-heading"
      className="mt-10 border border-[hsl(var(--mustard)/0.6)] bg-[hsl(var(--mustard)/0.06)] p-4 md:p-6"
    >
      <p className="kicker text-[hsl(40_85%_28%)]">
        Proposed role — candidate only, not one of the 109
      </p>
      <h3
        id="proposed-role-heading"
        className="mt-2 text-xl font-extrabold tracking-tight"
      >
        {p.name}
      </h3>
      <p className="mono mt-1 text-[11px] uppercase tracking-wider text-[hsl(var(--ink-soft))]">
        {p.status}
      </p>

      <div className="mt-4 space-y-4 text-sm">
        <div>
          <h4 className="kicker">Why it is proposed</h4>
          <p className="prose-evidence mt-1">{p.justification}</p>
        </div>
        <div>
          <h4 className="kicker">Recommended form</h4>
          <p className="mt-1">{p.recommendedForm}</p>
        </div>

        <dl className="grid gap-3 border-t border-[hsl(var(--line))] pt-4 md:grid-cols-2">
          <div>
            <dt className="kicker">Function</dt>
            <dd className="mt-1">{p.charter.function}</dd>
          </div>
          <div>
            <dt className="kicker">Mission (draft)</dt>
            <dd className="prose-evidence mt-1">{p.charter.mission}</dd>
          </div>
          <div>
            <dt className="kicker">Outputs (draft)</dt>
            <dd className="mt-1">{p.charter.outputs}</dd>
          </div>
          <div>
            <dt className="kicker">Core skills (draft)</dt>
            <dd className="mt-1">{p.charter.skills}</dd>
          </div>
          <div>
            <dt className="kicker">Senior scope (draft)</dt>
            <dd className="mt-1">{p.charter.senior}</dd>
          </div>
          <div>
            <dt className="kicker">Interfaces (draft)</dt>
            <dd className="mt-1">{p.charter.interfaces}</dd>
          </div>
        </dl>

        <div className="grid gap-3 border-t border-[hsl(var(--line))] pt-4 md:grid-cols-2">
          <div>
            <h4 className="kicker">Split triggers</h4>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {p.splitTriggers.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="kicker">Conditional capabilities it would own</h4>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {p.ownedConditionalCapabilities.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-[hsl(var(--line))] pt-4">
          <h4 className="kicker">Draft evaluation battery (ET-CAND)</h4>
          <p className="mono mt-1 text-[11px] uppercase tracking-wider text-[hsl(var(--ink-soft))]">
            Agent contexts sharing this territory: {p.agentContexts.join(' · ')}
          </p>
          <ol className="mt-2 space-y-2">
            {p.evaluationTasks.map((t) => (
              <li
                key={t.taskId}
                className="border border-[hsl(var(--line))] bg-[hsl(var(--paper))] p-3"
              >
                <p className="mono text-[11px] font-bold uppercase tracking-wider text-[hsl(var(--ink-soft))]">
                  {t.taskId} · {t.taskType.replace(/_/g, ' ')} · evidence:{' '}
                  {t.evidenceRequired}
                </p>
                <p className="prose-evidence mt-1">{t.task}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="border-t border-[hsl(var(--line))] pt-4">
          <h4 className="kicker">Draft resource inventory (candidate only)</h4>
          <p className="mb-2 mt-1 text-xs text-[hsl(var(--ink-soft))]">
            Fuller inventory from the ui-ux-research-design-engineering
            package. It attaches to this draft only — it is not a standing
            role&apos;s coverage and contributes no depth score.
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            {(['foundational', 'core', 'advanced'] as const).map((tier) => (
              <div key={tier}>
                <h5 className="mono text-[11px] font-bold uppercase tracking-wider text-[hsl(var(--ink-soft))]">
                  {tier} ({p.inventory[tier].length})
                </h5>
                <ul className="mt-1 space-y-1 text-xs">
                  {p.inventory[tier].map((r) => (
                    <li key={r.url}>
                      <a
                        className="text-[hsl(var(--cornflower))] underline underline-offset-2"
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {r.name}
                      </a>
                      <span className="text-[hsl(var(--ink-soft))]">
                        {' '}
                        · {r.flag}
                        {r.trigger ? ` — ${r.trigger}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-[hsl(var(--ink-soft))]">
          Status: proposal from the 2026-11-20 audit, with the specialist
          inventory and ET-CAND battery attached 2026-11-21. It is listed here
          for review only and is excluded from the role count, filters, and
          depth statistics above until ratified as a standing charter.
        </p>
      </div>
    </section>
  );
}

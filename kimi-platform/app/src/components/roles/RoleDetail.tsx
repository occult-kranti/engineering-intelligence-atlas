import { useMemo, useState } from 'react';
import { ExtLink } from '@/components/ExtLink';
import {
  ROLE_DETAILS,
  type MatrixResource,
  type ResourceTier,
} from '@/data/roleDetails';
import {
  ROLE_MATRIX_META,
  ROLE_OVERLAPS,
  type RoleMatrixEntry,
  type ScopeFlag,
} from '@/data/roleMatrix';
import type { Role } from '@/data/types';
import { SKILL_PACKAGES } from '@/data/skills';

/**
 * Expanded role matrix detail. This module statically imports the heavy
 * ROLE_DETAILS dataset, so it is loaded through React.lazy from the Roles
 * view — the ~0.8 MB detail chunk is only fetched when a reader first
 * expands a role.
 */

type TabId = 'mission' | 'curriculum' | 'evaluation' | 'boundaries';

const TABS: { id: TabId; label: string }[] = [
  { id: 'mission', label: 'Mission & ownership' },
  { id: 'curriculum', label: 'Curriculum' },
  { id: 'evaluation', label: 'Evaluation' },
  { id: 'boundaries', label: 'Boundaries / decomposition' },
];

const TIER_LABELS: Record<ResourceTier, string> = {
  foundational: 'Foundational — entry ramp & literacy',
  core: 'Core — working depth for the charter',
  advanced: 'Advanced — senior / specialist depth',
};

const FLAG_LABELS: Record<ScopeFlag, string> = {
  core: 'Core',
  internal: 'Internal',
  conditional: 'Conditional',
};

const EVIDENCE_LABELS: Record<MatrixResource['evidence'], string> = {
  E3: 'E3 · link verified',
  E2: 'E2 · unverified / blocked',
  'E0-stale': 'E0 · stale 404',
};

const VERDICT_LABELS: Record<RoleMatrixEntry['verdict'], string> = {
  split_at_scale: 'Split at scale',
  merge_candidate: 'Merge candidate',
  keep_combined: 'Keep combined',
};

const TASK_TYPE_LABELS: Record<string, string> = {
  portfolio_artifact: 'Portfolio artifact',
  scenario_simulation: 'Scenario simulation',
  senior_scope_defense: 'Senior-scope defense',
};

function packName(id: string): string {
  return SKILL_PACKAGES.find((p) => p.id === id)?.name ?? id;
}

function FlagChip({ flag }: { flag: ScopeFlag }) {
  const cls =
    flag === 'core'
      ? 'chip-cornflower'
      : flag === 'internal'
        ? 'chip-sage'
        : 'chip-mustard';
  return <span className={`chip ${cls}`}>{FLAG_LABELS[flag]}</span>;
}

function EvidenceChip({ evidence }: { evidence: MatrixResource['evidence'] }) {
  const cls =
    evidence === 'E3'
      ? 'chip-sage'
      : evidence === 'E2'
        ? 'chip-neutral'
        : 'chip-alert';
  return <span className={`chip ${cls}`}>{EVIDENCE_LABELS[evidence]}</span>;
}

function ResourceRow({ r }: { r: MatrixResource }) {
  return (
    <li className="border-b border-[hsl(var(--line))] py-3 last:border-b-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <ExtLink href={r.url} className="min-w-0 break-words font-semibold">
          {r.name}
        </ExtLink>
        <span className="flex flex-wrap items-center gap-1">
          <FlagChip flag={r.flag} />
          <EvidenceChip evidence={r.evidence} />
        </span>
      </div>
      <p className="mono mt-1 text-[11px] uppercase tracking-wider text-[hsl(var(--ink-soft))]">
        {r.domain} · {r.type} · level: {r.level}
      </p>
      <p className="mt-1 text-sm text-[hsl(var(--ink-soft))]">
        Prerequisite: {r.prerequisite} · Access & license: {r.access}
        {r.trigger ? (
          <>
            {' '}
            · <span className="font-semibold">Only when:</span> {r.trigger}
          </>
        ) : null}
      </p>
      {r.evidence === 'E0-stale' ? (
        <p className="mt-1 text-sm font-semibold text-[hsl(8_64%_30%)]">
          Stale link — returned HTTP 404 in the 2026-11-20 check; replace or
          re-verify before relying on this mapping.
        </p>
      ) : r.evidence === 'E2' ? (
        <p className="mt-1 text-xs text-[hsl(var(--ink-soft))]">
          Not probed, or blocked by a publisher bot-wall in the 2026-11-20
          check — treated as a weak signal, not a dead link.
        </p>
      ) : null}
    </li>
  );
}

export default function RoleDetail({
  role,
  entry,
  scope,
}: {
  role: Role;
  entry: RoleMatrixEntry;
  scope: ScopeFlag | 'all';
}) {
  const [tab, setTab] = useState<TabId>('mission');
  const detail = ROLE_DETAILS[entry.id];

  const tiers = useMemo(() => {
    const out: { tier: ResourceTier; items: MatrixResource[] }[] = [];
    for (const tier of ['foundational', 'core', 'advanced'] as ResourceTier[]) {
      const items = (detail?.resources[tier] ?? []).filter(
        (r) => scope === 'all' || r.flag === scope,
      );
      out.push({ tier, items });
    }
    return out;
  }, [detail, scope]);

  const shownCount = tiers.reduce((n, t) => n + t.items.length, 0);

  return (
    <div>
      <div
        role="tablist"
        aria-label={`Detail sections for ${role.name}`}
        className="-mx-1 mb-4 flex flex-wrap border-b border-[hsl(var(--line))]"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className="tab-control"
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'mission' && (
        <div role="tabpanel" aria-label="Mission and ownership">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="kicker">Mission</dt>
              <dd className="prose-evidence mt-1">{role.mission}</dd>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <dt className="kicker">Outputs</dt>
                <dd className="mt-1">{role.outputs}</dd>
              </div>
              <div>
                <dt className="kicker">Core skills</dt>
                <dd className="mt-1">{role.skills}</dd>
              </div>
              <div>
                <dt className="kicker">Senior scope</dt>
                <dd className="mt-1">{role.senior}</dd>
              </div>
              <div>
                <dt className="kicker">Interfaces</dt>
                <dd className="mt-1">{role.interfaces}</dd>
              </div>
            </div>
            <div>
              <dt className="kicker">Source framework</dt>
              <dd className="mt-1 break-words">
                <ExtLink href={role.source}>{role.source}</ExtLink>
              </dd>
            </div>
            <div>
              <dt className="kicker">Skill packages mapped</dt>
              <dd className="mt-1">
                {entry.skillPacks.length > 0 ? (
                  <span className="flex flex-wrap gap-1">
                    {entry.skillPacks.map((p) => (
                      <span key={p} className="chip chip-cornflower">
                        {packName(p)}
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className="text-[hsl(var(--ink-soft))]">
                    No agent skill package maps to this charter yet.
                  </span>
                )}
              </dd>
            </div>
            {detail && detail.scientificResources.length > 0 && (
              <div>
                <dt className="kicker">Scientific & model resources</dt>
                <dd className="mt-1">
                  <ul className="list-disc space-y-1 pl-5">
                    {detail.scientificResources.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {tab === 'curriculum' && (
        <div role="tabpanel" aria-label="Curriculum">
          <p className="mb-3 text-sm text-[hsl(var(--ink-soft))]">
            {shownCount} linked resource{shownCount === 1 ? '' : 's'}
            {scope !== 'all' ? (
              <>
                {' '}
                flagged <span className="font-semibold">{FLAG_LABELS[scope].toLowerCase()}</span>
                {' '}({entry.resourceCount} total across all scopes)
              </>
            ) : (
              <> across foundational, core, and advanced tiers</>
            )}
            . Access notes cover license/cost terms as curated; E2 links were
            unverified or bot-blocked, E0 links are stale and need replacement.
          </p>
          {tiers.map(({ tier, items }) =>
            items.length === 0 ? null : (
              <section key={tier} className="mb-4">
                <h4 className="kicker border-b border-[hsl(var(--ink))] pb-1">
                  {TIER_LABELS[tier]} ({items.length})
                </h4>
                <ul>
                  {items.map((r) => (
                    <ResourceRow key={`${tier}-${r.name}`} r={r} />
                  ))}
                </ul>
              </section>
            ),
          )}
          {detail && detail.capabilityGaps.length > 0 && (
            <section className="mt-2">
              <h4 className="kicker">Capability gaps</h4>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                {detail.capabilityGaps.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-[hsl(var(--ink-soft))]">
                Each unresolved gap subtracts 15 points from the depth heuristic
                — close these before using the matrix as a learning path.
              </p>
            </section>
          )}
        </div>
      )}

      {tab === 'evaluation' && (
        <div role="tabpanel" aria-label="Evaluation">
          <p className="mb-3 text-sm text-[hsl(var(--ink-soft))]">
            Three role-specific checks. Evidence must be demonstrated or
            attested — self-report alone does not pass.
          </p>
          <ol className="space-y-4">
            {(detail?.evaluationTasks ?? []).map((t, i) => (
              <li key={t.taskType}>
                <p className="kicker">
                  Task {i + 1} · {TASK_TYPE_LABELS[t.taskType] ?? t.taskType}
                </p>
                <p className="prose-evidence mt-1 text-sm">{t.task}</p>
                <p className="mt-1 text-sm">
                  <span className="font-semibold">Evidence required:</span>{' '}
                  {t.evidenceRequired}
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {tab === 'boundaries' && (
        <div role="tabpanel" aria-label="Boundaries and decomposition">
          {detail && (
            <div className="space-y-3 text-sm">
              <p>
                <span
                  className={`chip ${
                    entry.verdict === 'split_at_scale'
                      ? 'chip-mustard'
                      : entry.verdict === 'merge_candidate'
                        ? 'chip-alert'
                        : 'chip-sage'
                  }`}
                >
                  {VERDICT_LABELS[entry.verdict]}
                </span>
              </p>
              <div>
                <h4 className="kicker">Split / merge / keep-combined triggers</h4>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {detail.decomposition.triggers.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="kicker">Boundary notes</h4>
                <p className="prose-evidence mt-1">
                  {detail.decomposition.notes}
                </p>
              </div>
              {(ROLE_OVERLAPS[entry.id] ?? []).length > 0 && (
                <div>
                  <h4 className="kicker">Documented overlap</h4>
                  <p className="mt-1">
                    Overlapping charters:{' '}
                    {ROLE_OVERLAPS[entry.id].join('; ')}. Keep the boundary
                    explicit when staffing either side.
                  </p>
                </div>
              )}
              <p className="text-xs text-[hsl(var(--ink-soft))]">
                Decomposition rule: {ROLE_MATRIX_META.decompositionRule}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { lazy, Suspense, useMemo, useState } from 'react';
import { ExpandOnDemand } from '@/components/roles/ExpandOnDemand';
import { Pagination } from '@/components/Pagination';
import { paginate } from '@/lib/paginate';
import { SearchInput } from '@/components/SearchInput';
import { EvidenceNote, SectionHeader } from '@/components/SectionHeader';
import { ProposedRoleCard } from '@/components/roles/ProposedRoleCard';
import { ROLES } from '@/data/roles';
import { SKILL_PACKAGES } from '@/data/skills';
import {
  ROLE_MATRIX,
  ROLE_MATRIX_META,
  type RoleMatrixEntry,
  type ScopeFlag,
} from '@/data/roleMatrix';
import type { Role } from '@/data/types';
import { matchesQuery } from '@/lib/format';

// Heavy detail content (resources, evaluation tasks, decomposition notes) is
// code-split and only fetched when a reader first expands a role.
const RoleDetail = lazy(() => import('@/components/roles/RoleDetail'));

const PAGE_SIZE = 12;

type SortKey = 'name' | 'depth' | 'resources';

const SORT_LABELS: Record<SortKey, string> = {
  name: 'Name (A–Z)',
  depth: 'Depth score (high → low)',
  resources: 'Resource count (high → low)',
};

const SCOPE_LABELS: Record<ScopeFlag, string> = {
  core: 'Core — required for accountable outputs',
  internal: 'Internal — shared cross-functional literacy',
  conditional: 'Conditional — required only when a trigger fires',
};

const DEPTH_BAND_LABELS: Record<RoleMatrixEntry['depthBand'], string> = {
  'hire-ready': 'hire-ready depth',
  'adequate-with-gaps': 'adequate, noted gaps',
  'exceeds-coverage': 'coverage below charter',
};

function depthChipClass(band: RoleMatrixEntry['depthBand']): string {
  if (band === 'hire-ready') return 'chip chip-sage';
  if (band === 'adequate-with-gaps') return 'chip chip-mustard';
  return 'chip chip-alert';
}

export default function Roles() {
  const [query, setQuery] = useState('');
  const [func, setFunc] = useState('all');
  const [pack, setPack] = useState('all');
  const [scope, setScope] = useState<ScopeFlag | 'all'>('all');
  const [sort, setSort] = useState<SortKey>('name');
  const [page, setPage] = useState(0);

  // Join the standing 109 charters with the audit matrix by name. The matrix
  // adds depth/resource data; the charter data (mission/outputs/skills/…)
  // stays the source of truth for identity.
  const rows = useMemo(() => {
    const byName = new Map(ROLE_MATRIX.map((e) => [e.name, e]));
    return ROLES.map((role) => ({ role, entry: byName.get(role.name) })).filter(
      (r): r is { role: Role; entry: RoleMatrixEntry } => Boolean(r.entry),
    );
  }, []);

  const functions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.role.function))).sort(),
    [rows],
  );

  const scopeRoleCounts = useMemo(() => {
    const counts: Record<ScopeFlag, number> = { core: 0, internal: 0, conditional: 0 };
    for (const { entry } of rows) {
      for (const s of ['core', 'internal', 'conditional'] as ScopeFlag[]) {
        if (entry.scopeCounts[s] > 0) counts[s] += 1;
      }
    }
    return counts;
  }, [rows]);

  const packRoleCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const { entry } of rows) {
      for (const p of entry.skillPacks) counts.set(p, (counts.get(p) ?? 0) + 1);
    }
    return counts;
  }, [rows]);

  const filtered = useMemo(() => {
    const out = rows.filter(({ role, entry }) => {
      if (func !== 'all' && role.function !== func) return false;
      if (pack !== 'all' && !entry.skillPacks.includes(pack)) return false;
      if (scope !== 'all' && entry.scopeCounts[scope] === 0) return false;
      if (!query.trim()) return true;
      return matchesQuery(
        `${role.name} ${role.function} ${role.mission} ${role.outputs} ${role.skills} ${role.interfaces}`,
        query,
      );
    });
    const sorted = [...out];
    if (sort === 'name') {
      sorted.sort((a, b) => a.role.name.localeCompare(b.role.name));
    } else if (sort === 'depth') {
      sorted.sort(
        (a, b) => b.entry.depthScore - a.entry.depthScore || a.role.name.localeCompare(b.role.name),
      );
    } else {
      sorted.sort(
        (a, b) => b.entry.resourceCount - a.entry.resourceCount || a.role.name.localeCompare(b.role.name),
      );
    }
    return sorted;
  }, [rows, query, func, pack, scope, sort]);

  const { pageCount, page: safePage, slice } = paginate(filtered, page, PAGE_SIZE);

  const reset = () => {
    setQuery('');
    setFunc('all');
    setPack('all');
    setScope('all');
    setSort('name');
    setPage(0);
  };

  const hasFilters =
    query.trim() !== '' || func !== 'all' || pack !== 'all' || scope !== 'all';

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-8 md:py-12">
      <SectionHeader
        kicker="Chapter 02 · Role directory"
        title={`${ROLES.length} roles by function, mapped to resources`}
      >
        Every role carries a mission, outputs, core skills, senior-level scope,
        and interfaces — now joined with the {ROLE_MATRIX_META.generated}{' '}
        capability/depth audit: a tiered curriculum of linked resources,
        role-specific evaluation tasks, and split/merge boundaries. Roles are
        reference architectures drawn from public frameworks — SFIA, the NICE
        workforce framework, the Google SRE workbook, and published career
        frameworks — not any company's org chart.
      </SectionHeader>

      <EvidenceNote title="Depth score is a heuristic, not job-performance evidence">
        The 0–100 depth score only measures how well the curated resource
        catalog covers each charter:{' '}
        <span className="mono text-xs">{ROLE_MATRIX_META.depthFormula}</span>{' '}
        Tier targets are {ROLE_MATRIX_META.depthTargets.foundational} foundational /{' '}
        {ROLE_MATRIX_META.depthTargets.core} core /{' '}
        {ROLE_MATRIX_META.depthTargets.advanced} advanced resources; conditional
        items and shared-literacy resources (&gt;30 roles, e.g.{' '}
        {ROLE_MATRIX_META.sharedLiteracyExcluded.join(', ')}) are excluded;
        penalties apply for stale links (−10) and unresolved capability gaps
        (−15 each). Bands: {ROLE_MATRIX_META.depthInterpretation} Across the{' '}
        {ROLE_MATRIX_META.roleCount} roles the mean is{' '}
        {ROLE_MATRIX_META.depthStats.mean}. It says nothing about any person's
        performance in the role.
      </EvidenceNote>

      <div className="mb-4 mt-6 grid gap-3 md:grid-cols-2">
        <SearchInput
          value={query}
          onChange={(v) => {
            setQuery(v);
            setPage(0);
          }}
          label="Search roles by name, mission, skill, or interface"
          placeholder="Search roles, e.g. “incident” or “geometry”"
        />
        <div>
          <label htmlFor="role-fn" className="sr-only">
            Filter by function
          </label>
          <select
            id="role-fn"
            className="input"
            value={func}
            onChange={(e) => {
              setFunc(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">All functions ({rows.length})</option>
            {functions.map((f) => (
              <option key={f} value={f}>
                {f} ({rows.filter((r) => r.role.function === f).length})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="role-scope" className="sr-only">
            Filter by resource scope
          </label>
          <select
            id="role-scope"
            className="input"
            value={scope}
            onChange={(e) => {
              setScope(e.target.value as ScopeFlag | 'all');
              setPage(0);
            }}
          >
            <option value="all">All resource scopes</option>
            {(Object.keys(SCOPE_LABELS) as ScopeFlag[]).map((s) => (
              <option key={s} value={s}>
                {SCOPE_LABELS[s]} ({scopeRoleCounts[s]})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="role-pack" className="sr-only">
            Filter by skill package
          </label>
          <select
            id="role-pack"
            className="input"
            value={pack}
            onChange={(e) => {
              setPack(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">
              All skill packages ({SKILL_PACKAGES.length})
            </option>
            {SKILL_PACKAGES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({packRoleCounts.get(p.id) ?? 0})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="mono text-xs text-[hsl(var(--ink-soft))]" aria-live="polite">
          {filtered.length} of {rows.length} roles match
          {scope !== 'all' ? ` · showing ${scope}-scope resources in curricula` : ''}
          {hasFilters && (
            <button
              type="button"
              className="ml-2 underline underline-offset-2 hover:text-[hsl(var(--ink))]"
              onClick={reset}
            >
              Clear filters
            </button>
          )}
        </p>
        <div className="flex items-center gap-2">
          <label
            htmlFor="role-sort"
            className="mono text-[11px] uppercase tracking-wider text-[hsl(var(--ink-soft))]"
          >
            Sort
          </label>
          <select
            id="role-sort"
            className="input w-auto"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as SortKey);
              setPage(0);
            }}
          >
            {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
              <option key={k} value={k}>
                {SORT_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-6 text-center">
          <p className="font-semibold">No roles match these filters.</p>
          <p className="mt-1 text-sm text-[hsl(var(--ink-soft))]">
            Try a broader search term or clear the function, scope, and
            skill-package filters.
          </p>
          <button type="button" className="btn mt-4" onClick={reset}>
            Clear all filters
          </button>
        </div>
      ) : (
        <ol className="border-t border-[hsl(var(--ink))]">
          {slice.map(({ role, entry }, idx) => (
            <li key={role.name} className="border-b border-[hsl(var(--line))]">
              <ExpandOnDemand
                header={() => (
                  <span className="flex min-w-0 items-baseline gap-3">
                    <span className="mono w-8 shrink-0 text-xs text-[hsl(var(--ink-soft))]">
                      {String(safePage * PAGE_SIZE + idx + 1).padStart(3, '0')}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-base font-bold leading-snug">
                        {role.name}
                      </span>
                      <span className="mono mt-1 block text-[11px] uppercase tracking-wider text-[hsl(var(--ink-soft))]">
                        {role.function}
                      </span>
                      <span className="mt-2 flex flex-wrap items-center gap-1">
                        <span
                          className={depthChipClass(entry.depthBand)}
                          title={`${DEPTH_BAND_LABELS[entry.depthBand]} — curated coverage heuristic, not job-performance evidence`}
                        >
                          depth {Math.round(entry.depthScore)} · heuristic
                        </span>
                        <span className="chip chip-neutral">
                          {entry.resourceCount} resources
                        </span>
                        {entry.staleCount > 0 && (
                          <span className="chip chip-alert">
                            {entry.staleCount} stale link
                            {entry.staleCount === 1 ? '' : 's'}
                          </span>
                        )}
                        {entry.gapsCount > 0 && (
                          <span className="chip chip-mustard">
                            {entry.gapsCount} gap{entry.gapsCount === 1 ? '' : 's'}
                          </span>
                        )}
                      </span>
                    </span>
                  </span>
                )}
              >
                <Suspense
                  fallback={
                    <p className="py-4 text-sm text-[hsl(var(--ink-soft))]">
                      Loading role matrix detail…
                    </p>
                  }
                >
                  <RoleDetail role={role} entry={entry} scope={scope} />
                </Suspense>
              </ExpandOnDemand>
            </li>
          ))}
        </ol>
      )}

      <Pagination
        page={safePage}
        pageCount={pageCount}
        onPage={setPage}
        total={filtered.length}
        pageSize={PAGE_SIZE}
      />

      <ProposedRoleCard />
    </div>
  );
}

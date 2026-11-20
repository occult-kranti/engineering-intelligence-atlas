import { useMemo, useState } from 'react';
import { Expand } from '@/components/Expand';
import { ExtLink } from '@/components/ExtLink';
import { Pagination } from '@/components/Pagination';
import { paginate } from '@/lib/paginate';
import { SearchInput } from '@/components/SearchInput';
import { SectionHeader } from '@/components/SectionHeader';
import { ROLES } from '@/data/roles';
import { matchesQuery } from '@/lib/format';

const PAGE_SIZE = 12;

export default function Roles() {
  const [query, setQuery] = useState('');
  const [func, setFunc] = useState('all');
  const [page, setPage] = useState(0);

  const functions = useMemo(
    () => Array.from(new Set(ROLES.map((r) => r.function))).sort(),
    [],
  );

  const filtered = useMemo(() => {
    return ROLES.filter((r) => {
      if (func !== 'all' && r.function !== func) return false;
      if (!query.trim()) return true;
      return matchesQuery(
        `${r.name} ${r.function} ${r.mission} ${r.skills} ${r.interfaces}`,
        query,
      );
    });
  }, [query, func]);

  const { pageCount, page: safePage, slice } = paginate(filtered, page, PAGE_SIZE);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-8 md:py-12">
      <SectionHeader kicker="Chapter 02 · Role directory" title={`${ROLES.length} roles by function`}>
        Every role carries a mission, outputs, core skills, senior-level scope,
        and interfaces. Roles are reference architectures drawn from public
        frameworks — SFIA, the NICE workforce framework, the Google SRE
        workbook, and published career frameworks — not any company's org
        chart.
      </SectionHeader>

      <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_280px]">
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
            <option value="all">All functions ({ROLES.length})</option>
            {functions.map((f) => (
              <option key={f} value={f}>
                {f} ({ROLES.filter((r) => r.function === f).length})
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="mono mb-3 text-xs text-[hsl(var(--ink-soft))]" aria-live="polite">
        {filtered.length} of {ROLES.length} roles match
      </p>

      <ol className="border-t border-[hsl(var(--ink))]">
        {slice.map((r, idx) => (
          <li key={r.name} className="border-b border-[hsl(var(--line))]">
            <Expand
              header={() => (
                <span className="flex min-w-0 items-baseline gap-3">
                  <span className="mono w-8 shrink-0 text-xs text-[hsl(var(--ink-soft))]">
                    {String(safePage * PAGE_SIZE + idx + 1).padStart(3, '0')}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-base font-bold leading-snug">{r.name}</span>
                    <span className="mono mt-1 block text-[11px] uppercase tracking-wider text-[hsl(var(--ink-soft))]">
                      {r.function}
                    </span>
                  </span>
                </span>
              )}
            >
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="kicker">Mission</dt>
                  <dd className="prose-evidence mt-1">{r.mission}</dd>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <dt className="kicker">Outputs</dt>
                    <dd className="mt-1">{r.outputs}</dd>
                  </div>
                  <div>
                    <dt className="kicker">Core skills</dt>
                    <dd className="mt-1">{r.skills}</dd>
                  </div>
                  <div>
                    <dt className="kicker">Senior scope</dt>
                    <dd className="mt-1">{r.senior}</dd>
                  </div>
                  <div>
                    <dt className="kicker">Interfaces</dt>
                    <dd className="mt-1">{r.interfaces}</dd>
                  </div>
                </div>
                <div>
                  <dt className="kicker">Source framework</dt>
                  <dd className="mt-1 break-words">
                    <ExtLink href={r.source}>{r.source}</ExtLink>
                  </dd>
                </div>
              </dl>
            </Expand>
          </li>
        ))}
      </ol>

      <Pagination
        page={safePage}
        pageCount={pageCount}
        onPage={setPage}
        total={filtered.length}
        pageSize={PAGE_SIZE}
      />
    </div>
  );
}

import { useMemo, useState } from 'react';
import { ExtLink } from '@/components/ExtLink';
import { Pagination } from '@/components/Pagination';
import { paginate } from '@/lib/paginate';
import { SearchInput } from '@/components/SearchInput';
import { SectionHeader } from '@/components/SectionHeader';
import { AGENT_REPOS, COMMUNITIES, SKILL_ENTRIES, TOPIC_SEARCHES } from '@/data/ecosystem';
import { RESOURCES } from '@/data/resources';
import { fmt, matchesQuery } from '@/lib/format';

const PAGE_SIZE = 15;

type TabId = 'resources' | 'repos' | 'skills' | 'topics' | 'communities';

function FlagChip({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'alert' | 'sage' | 'mustard' | 'cornflower' }) {
  return <span className={`chip chip-${tone}`}>{children}</span>;
}

const licenseFlag = (license: string) => {
  const l = license.toLowerCase();
  if (l.includes('no root license') || l.includes('not open source')) return 'No open license';
  if (l.includes('verify')) return 'Verify license';
  return null;
};
const statusFlag = (status: string) => {
  const s = status.toLowerCase();
  if (s.includes('deprecated')) return 'Deprecated';
  if (s.includes('archived') || s.includes('404')) return 'Unavailable';
  if (s.includes('maintenance')) return 'Maintenance mode';
  if (s.includes('legacy') || s === 'demo') return 'Legacy / demo';
  return null;
};

export default function Library() {
  const [tab, setTab] = useState<TabId>('resources');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [facet, setFacet] = useState('all');

  const reset = (t: TabId) => {
    setTab(t);
    setQuery('');
    setPage(0);
    setFacet('all');
  };

  const tabs: { id: TabId; label: string; count: number }[] = [
    { id: 'resources', label: 'Resources', count: RESOURCES.length },
    { id: 'repos', label: 'Agent repositories', count: AGENT_REPOS.length },
    { id: 'skills', label: 'Skills & plugins', count: SKILL_ENTRIES.length },
    { id: 'topics', label: 'Topic searches', count: TOPIC_SEARCHES.length },
    { id: 'communities', label: 'Communities', count: COMMUNITIES.length },
  ];

  /* ---------------- filtered datasets ---------------- */
  const resources = useMemo(
    () =>
      RESOURCES.filter((r) => {
        if (facet !== 'all' && r.level !== facet) return false;
        if (!query.trim()) return true;
        return matchesQuery(`${r.name} ${r.domain} ${r.type} ${r.purpose}`, query);
      }),
    [query, facet],
  );

  const repos = useMemo(
    () =>
      AGENT_REPOS.filter((r) => {
        if (facet === 'deprecated' && !statusFlag(r.status)) return false;
        if (facet === 'nolicense' && !licenseFlag(r.license)) return false;
        if (facet === 'official' && !/official/i.test(r.official)) return false;
        if (facet === 'community' && !/community/i.test(r.official)) return false;
        if (!query.trim()) return true;
        return matchesQuery(`${r.repository} ${r.domain} ${r.purpose} ${r.status}`, query);
      }),
    [query, facet],
  );

  const skills = useMemo(
    () =>
      SKILL_ENTRIES.filter((s) => {
        if (facet !== 'all' && s.vendor !== facet && s.type !== facet) return false;
        if (!query.trim()) return true;
        return matchesQuery(`${s.name} ${s.vendor} ${s.type} ${s.status}`, query);
      }),
    [query, facet],
  );

  const topics = useMemo(
    () =>
      TOPIC_SEARCHES.filter((t) => {
        if (facet !== 'all' && t.domain !== facet) return false;
        if (!query.trim()) return true;
        return matchesQuery(`${t.domain} ${t.tags} ${t.query}`, query);
      }),
    [query, facet],
  );

  const communities = useMemo(
    () =>
      COMMUNITIES.filter((c) => {
        if (facet !== 'all' && c.platform !== facet) return false;
        if (!query.trim()) return true;
        return matchesQuery(`${c.name} ${c.domain} ${c.platform} ${c.official}`, query);
      }),
    [query, facet],
  );

  const facetOptions: Record<TabId, { value: string; label: string }[]> = {
    resources: [
      { value: 'all', label: `All levels (${RESOURCES.length})` },
      ...Array.from(new Set(RESOURCES.map((r) => r.level))).sort().map((l) => ({
        value: l,
        label: `${l} (${RESOURCES.filter((r) => r.level === l).length})`,
      })),
    ],
    repos: [
      { value: 'all', label: 'All repositories' },
      { value: 'official', label: 'Official vendor-hosted' },
      { value: 'community', label: 'Community submissions' },
      { value: 'deprecated', label: 'Deprecated / unavailable / legacy' },
      { value: 'nolicense', label: 'No open license' },
    ],
    skills: [
      { value: 'all', label: `All vendors & types (${SKILL_ENTRIES.length})` },
      ...Array.from(new Set(SKILL_ENTRIES.map((s) => s.vendor))).sort().map((v) => ({
        value: v,
        label: `Vendor: ${v} (${SKILL_ENTRIES.filter((s) => s.vendor === v).length})`,
      })),
      ...Array.from(new Set(SKILL_ENTRIES.map((s) => s.type))).sort().map((t) => ({
        value: t,
        label: `Type: ${t} (${SKILL_ENTRIES.filter((s) => s.type === t).length})`,
      })),
    ],
    topics: [
      { value: 'all', label: `All domains (${TOPIC_SEARCHES.length})` },
      ...Array.from(new Set(TOPIC_SEARCHES.map((t) => t.domain))).sort().map((d) => ({
        value: d,
        label: d,
      })),
    ],
    communities: [
      { value: 'all', label: `All platforms (${COMMUNITIES.length})` },
      ...Array.from(new Set(COMMUNITIES.map((c) => c.platform))).sort().map((p) => ({
        value: p,
        label: `${p} (${COMMUNITIES.filter((c) => c.platform === p).length})`,
      })),
    ],
  };

  const paged = {
    resources: paginate(resources, page, PAGE_SIZE),
    repos: paginate(repos, page, PAGE_SIZE),
    skills: paginate(skills, page, PAGE_SIZE),
    topics: paginate(topics, page, PAGE_SIZE),
    communities: paginate(communities, page, PAGE_SIZE),
  };
  const active = paged[tab];
  const activeTotal = { resources, repos, skills, topics, communities }[tab].length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-8 md:py-12">
      <SectionHeader kicker="Chapter 03 · Resource & agent library" title="Curated resources and the agent ecosystem">
        Learning resources carry level, access, and license notes. Agent
        repositories and skills carry lifecycle, license, and official-status
        flags — deprecated, unlicensed, and community submissions are marked
        inline. All entries link to their real external source.
      </SectionHeader>

      <div role="tablist" aria-label="Library sections" className="mb-4 flex flex-wrap border-b border-[hsl(var(--ink))]">
        {tabs.map((t, i) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            aria-controls="library-panel"
            id={`tab-${t.id}`}
            type="button"
            className="tab-control"
            onClick={() => reset(t.id)}
          >
            <span className="mono text-xs">{String(i + 1).padStart(2, '0')}</span>
            {t.label}
            <span className="mono text-xs">({t.count})</span>
          </button>
        ))}
      </div>

      <div id="library-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_300px]">
          <SearchInput
            value={query}
            onChange={(v) => {
              setQuery(v);
              setPage(0);
            }}
            label={`Search ${tabs.find((t) => t.id === tab)?.label}`}
          />
          <div>
            <label htmlFor="library-facet" className="sr-only">
              Filter
            </label>
            <select
              id="library-facet"
              className="input"
              value={facet}
              onChange={(e) => {
                setFacet(e.target.value);
                setPage(0);
              }}
              aria-label="Filter entries"
            >
              {facetOptions[tab].map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="mono mb-3 text-xs text-[hsl(var(--ink-soft))]" aria-live="polite">
          {activeTotal} entries match
        </p>

        {tab === 'resources' && (
          <ol className="border-t border-[hsl(var(--ink))]">
            {paged.resources.slice.map((r) => (
              <li key={r.name} className="border-b border-[hsl(var(--line))] py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <ExtLink href={r.url} className="text-base font-bold">
                    {r.name}
                  </ExtLink>
                  <span className="flex flex-wrap gap-1">
                    <FlagChip tone="cornflower">{r.level}</FlagChip>
                    <FlagChip>{r.type}</FlagChip>
                    {r.access !== 'Free' ? <FlagChip tone="mustard">{r.access}</FlagChip> : null}
                  </span>
                </div>
                <p className="prose-evidence mt-1 text-sm">{r.purpose}</p>
                <p className="mt-1 text-xs text-[hsl(var(--ink-soft))]">
                  <span className="font-semibold">{r.domain}</span> · License: {r.license} ·
                  Prerequisites: {r.prereqs} · <span className="mono">verified {r.verified}</span>
                </p>
                <p className="prose-evidence mt-1 text-xs italic text-[hsl(var(--ink-soft))]">{r.caveat}</p>
              </li>
            ))}
          </ol>
        )}

        {tab === 'repos' && (
          <ol className="border-t border-[hsl(var(--ink))]">
            {paged.repos.slice.map((r) => {
              const sf = statusFlag(r.status);
              const lf = licenseFlag(r.license);
              const community = /community/i.test(r.official);
              return (
                <li key={r.repository} className="border-b border-[hsl(var(--line))] py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <ExtLink href={r.url} className="mono text-base font-bold">
                      {r.repository}
                    </ExtLink>
                    <span className="flex flex-wrap gap-1">
                      {sf ? <FlagChip tone="alert">{sf}</FlagChip> : <FlagChip tone="sage">{r.status}</FlagChip>}
                      {lf ? <FlagChip tone="alert">{lf}</FlagChip> : null}
                      {community ? <FlagChip tone="mustard">Community submissions</FlagChip> : <FlagChip tone="cornflower">{r.official}</FlagChip>}
                    </span>
                  </div>
                  <p className="prose-evidence mt-1 text-sm">{r.purpose}</p>
                  <p className="mono mt-1 text-xs text-[hsl(var(--ink-soft))]">
                    {r.domain} · license: {r.license}
                    {r.stars != null ? ` · ${fmt(r.stars)} stars (snapshot)` : ''}
                    {r.pushedAt ? ` · pushed ${r.pushedAt}` : ''} · verified {r.verified}
                  </p>
                  <p className="prose-evidence mt-1 text-xs italic text-[hsl(var(--ink-soft))]">{r.caveat}</p>
                </li>
              );
            })}
          </ol>
        )}

        {tab === 'skills' && (
          <ol className="border-t border-[hsl(var(--ink))]">
            {paged.skills.slice.map((s) => {
              const sf = statusFlag(s.status);
              const lf = licenseFlag(s.license);
              return (
                <li key={`${s.vendor}-${s.name}`} className="border-b border-[hsl(var(--line))] py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <ExtLink href={s.url} className="mono text-base font-bold">
                      {s.name}
                    </ExtLink>
                    <span className="flex flex-wrap gap-1">
                      <FlagChip tone="cornflower">{s.vendor}</FlagChip>
                      <FlagChip>{s.type}</FlagChip>
                      {sf ? <FlagChip tone="alert">{sf}</FlagChip> : null}
                      {lf ? <FlagChip tone="alert">{lf}</FlagChip> : null}
                    </span>
                  </div>
                  <p className="mono mt-1 text-xs text-[hsl(var(--ink-soft))]">
                    {s.status} · license: {s.license} · verified {s.verified}
                  </p>
                  <p className="prose-evidence mt-1 text-xs italic text-[hsl(var(--ink-soft))]">{s.caveat}</p>
                </li>
              );
            })}
          </ol>
        )}

        {tab === 'topics' && (
          <ol className="border-t border-[hsl(var(--ink))]">
            {paged.topics.slice.map((t) => (
              <li key={t.url} className="border-b border-[hsl(var(--line))] py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <ExtLink href={t.url} className="text-base font-bold">
                    {t.domain}
                  </ExtLink>
                  <FlagChip tone="sage">verified {t.verified}</FlagChip>
                </div>
                <p className="mt-1 text-sm">{t.tags}</p>
                <p className="mono mt-2 overflow-x-auto border border-[hsl(var(--line))] bg-[hsl(var(--paper))] px-2 py-1 text-xs">
                  {t.query}
                </p>
                <p className="prose-evidence mt-1 text-xs italic text-[hsl(var(--ink-soft))]">{t.caveat}</p>
              </li>
            ))}
          </ol>
        )}

        {tab === 'communities' && (
          <ol className="border-t border-[hsl(var(--ink))]">
            {paged.communities.slice.map((c) => (
              <li key={`${c.name}-${c.platform}`} className="border-b border-[hsl(var(--line))] py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <ExtLink href={c.url} className="text-base font-bold">
                    {c.name}
                  </ExtLink>
                  <span className="flex flex-wrap gap-1">
                    <FlagChip tone="cornflower">{c.platform}</FlagChip>
                    {/community|unofficial/i.test(c.official) ? (
                      <FlagChip tone="mustard">Community-run</FlagChip>
                    ) : (
                      <FlagChip tone="sage">{c.official}</FlagChip>
                    )}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[hsl(var(--ink-soft))]">
                  {c.domain} · Access: {c.access} · <span className="mono">verified {c.verified}</span>
                </p>
                <p className="prose-evidence mt-1 text-xs italic text-[hsl(var(--ink-soft))]">{c.caveat}</p>
              </li>
            ))}
          </ol>
        )}

        <Pagination
          page={active.page}
          pageCount={active.pageCount}
          onPage={setPage}
          total={activeTotal}
          pageSize={PAGE_SIZE}
        />
      </div>
    </div>
  );
}

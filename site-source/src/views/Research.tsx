import { useMemo, useState } from 'react';
import { ExtLink } from '@/components/ExtLink';
import { Pagination } from '@/components/Pagination';
import { paginate } from '@/lib/paginate';
import { SearchInput } from '@/components/SearchInput';
import { EvidenceNote, SectionHeader, SubHead } from '@/components/SectionHeader';
import { PAPERS } from '@/data/papers';
import { fmt, matchesQuery } from '@/lib/format';

const PAGE_SIZE = 12;

const DIRECTOR_LOOP = [
  {
    step: '1 · Triage and authorize',
    body: 'Record the user outcome, deliverables, risk, allowed side effects, data classes, budget, deadline, and approval gates. Refuse scope expansion that bypasses source policy, credentials, physical safety, or authorization. Obtain human approval before external writes, spending, production changes, or physical action.',
  },
  {
    step: '2 · Decompose and contract',
    body: 'Break the goal into bounded specialist tasks. Every delegation is a written contract: inputs, expected evidence, allowed tools, budget, deadline, and the exact deliverable format. No contract, no dispatch.',
  },
  {
    step: '3 · Dispatch bounded specialists',
    body: 'Route each task to the narrowest capable skill package. Progressive disclosure: load only the references a task needs. Specialists return evidence, not vibes — claims carry sources, dates, and confidence.',
  },
  {
    step: '4 · Evidence gates',
    body: 'Intermediate results pass gates before downstream use: provenance check, date check, source-policy check, and contradiction check against earlier evidence. Failed gates route back with a specific defect note.',
  },
  {
    step: '5 · Resolve, terminate, evaluate',
    body: 'Conflicts resolve by evidence tier and recency, not by agent confidence. Loops have explicit termination conditions and cost ceilings. Afterward, evaluate whether the multi-agent decomposition beat a single-pass baseline.',
  },
];

const SECURITY_RULES = [
  'Audit every skill, plugin, and MCP server before use: manifests, hooks, bundled scripts, permissions, and network calls.',
  'Pin versions and verify provenance; treat per-skill LICENSE.txt files as the licensing unit when no root license exists.',
  'Public visibility is not a reuse license; “no root license detected” means no grant of reuse.',
  'Deprecated or archived skills are quarantined from new delegations; their content is reference-only.',
  'Agent skills can carry prompt-injection risk: never pipe untrusted skill content into a privileged context.',
  'Community submissions require independent security review before any execution.',
  'Credentials stay scoped per task; autonomous scanning requires explicit repository and data authorization.',
];

export default function Research() {
  const [query, setQuery] = useState('');
  const [collection, setCollection] = useState('all');
  const [page, setPage] = useState(0);

  const collections = useMemo(
    () => Array.from(new Set(PAPERS.map((p) => p.collection))).sort(),
    [],
  );

  const filtered = useMemo(
    () =>
      PAPERS.filter((p) => {
        if (collection !== 'all' && p.collection !== collection) return false;
        if (!query.trim()) return true;
        return matchesQuery(`${p.title} ${p.authors} ${p.publicationInfo}`, query);
      }),
    [query, collection],
  );

  const { pageCount, page: safePage, slice } = paginate(filtered, page, PAGE_SIZE);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-8 md:py-12">
      <SectionHeader kicker="Chapter 06 · Research & governance" title="Paper catalog and the director loop">
        {PAPERS.length} papers across three scholar collections — reasoning and
        acting agents, multi-agent systems, and agent-skill security —
        deduplicated by canonical URL with publication and preprint wording
        preserved from the source records.
      </SectionHeader>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_260px]">
            <SearchInput
              value={query}
              onChange={(v) => {
                setQuery(v);
                setPage(0);
              }}
              label="Search papers by title, author, or venue"
              placeholder="Search papers, e.g. “ReAct” or “security”"
            />
            <div>
              <label htmlFor="paper-coll" className="sr-only">
                Filter by collection
              </label>
              <select
                id="paper-coll"
                className="input"
                value={collection}
                onChange={(e) => {
                  setCollection(e.target.value);
                  setPage(0);
                }}
              >
                <option value="all">All collections ({PAPERS.length})</option>
                {collections.map((c) => (
                  <option key={c} value={c}>
                    {c} ({PAPERS.filter((p) => p.collection === c).length})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="mono mb-4 text-xs text-[hsl(var(--ink-soft))]" aria-live="polite">
            {filtered.length} of {PAPERS.length} papers match
          </p>

          <ol className="space-y-3">
            {slice.map((p) => (
              <li key={p.url} className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <ExtLink href={p.url} className="text-base font-bold">
                    {p.title}
                  </ExtLink>
                  <span className="mono chip chip-cornflower">
                    {fmt(p.citations)} citations
                  </span>
                </div>
                <p className="mt-1 text-sm">{p.authors}</p>
                <p className="prose-evidence mt-1 text-xs italic text-[hsl(var(--ink-soft))]">
                  {p.publicationInfo}
                </p>
                <p className="mt-2">
                  <span className="chip chip-sage">{p.collection}</span>
                </p>
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

        <div className="space-y-6">
          <div className="panel-dark p-5">
            <SubHead>The director loop</SubHead>
            <ol className="space-y-4">
              {DIRECTOR_LOOP.map((d) => (
                <li key={d.step}>
                  <p className="text-sm font-bold text-[hsl(42_78%_55%)]">{d.step}</p>
                  <p className="prose-evidence mt-1 text-sm text-[hsl(var(--dark-ink-soft))]">
                    {d.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      <div className="rule my-10" />

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <SubHead>Security & skill supply-chain rules</SubHead>
          <ul className="space-y-3">
            {SECURITY_RULES.map((r) => (
              <li key={r} className="border border-[hsl(var(--line))] border-l-[3px] border-l-[hsl(var(--sage))] bg-[hsl(var(--paper-raised))] p-3 text-sm">
                {r}
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-4">
          <SubHead>Evaluation baselines</SubHead>
          <EvidenceNote title="Multi-agent is a hypothesis" accent="cornflower">
            <p>
              Before crediting a swarm, compare against baselines: a single
              well-scoped agent, a single-pass human review, and the cheapest
              tool that answers the question. The director package records the
              baseline it beat — or states plainly that none was beaten.
            </p>
          </EvidenceNote>
          <EvidenceNote title="Evidence gates in practice" accent="mustard">
            <p>
              A gate is a checklist with a veto: provenance (where did this
              claim come from?), date (is the snapshot current enough?),
              policy (was the source collected lawfully and within terms?), and
              contradiction (does newer or higher-tier evidence disagree?).
              Research catalog entries here carry citation counts as attention
              signals; preprints are labeled as preprints in their source
              wording.
            </p>
          </EvidenceNote>
          <EvidenceNote title="Delegation contracts" accent="sage">
            <p>
              Contracts make delegation auditable. Each one names inputs,
              deliverable format, allowed tools and data classes, budget,
              deadline, and evidence requirements — so a failed task fails
              loudly at its gate instead of silently contaminating downstream
              work.
            </p>
          </EvidenceNote>
        </div>
      </div>
    </div>
  );
}

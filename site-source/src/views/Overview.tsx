import { useMemo, useState } from 'react';
import { EvidenceNote, SectionHeader, SubHead } from '@/components/SectionHeader';
import { Stat } from '@/components/Stat';
import { ROLES } from '@/data/roles';
import { RESOURCES } from '@/data/resources';
import { JOBS } from '@/data/jobs';
import { SKILL_PACKAGES } from '@/data/skills';
import type { SkillPackage } from '@/data/types';

const ACCENT_HSL: Record<SkillPackage['accent'], string> = {
  mustard: 'hsl(42 78% 45%)',
  sage: 'hsl(82 22% 48%)',
  cornflower: 'hsl(219 46% 58%)',
};

const SKILL_POS: Record<string, { x: number; y: number }> = {
  'engineering-organization-architect': { x: 150, y: 118 },
  'engineering-job-market-intelligence': { x: 150, y: 462 },
  'defensive-reverse-engineering': { x: 810, y: 118 },
  'spatial-3d-production-engineering': { x: 810, y: 462 },
  'computational-geometry-engineering': { x: 480, y: 78 },
  'architecture-and-built-heritage-research': { x: 480, y: 502 },
  'local-model-runtime-engineering': { x: 810, y: 290 },
  'agent-research-director': { x: 480, y: 290 },
  // Science & models band (added with the 7 science/model-library packages)
  'game-reconstruction-engineering': { x: 150, y: 610 },
  'ai-open-model-research': { x: 810, y: 610 },
  'mathematics-research': { x: 110, y: 724 },
  'physics-research': { x: 300, y: 724 },
  'chemistry-research': { x: 480, y: 724 },
  'biology-research': { x: 660, y: 724 },
  'science-history-research': { x: 850, y: 724 },
};

const DOMAINS: { id: string; label: string; x: number; y: number; skills: string[] }[] = [
  { id: 'd-org', label: 'Organization & roles', x: 300, y: 168, skills: ['engineering-organization-architect'] },
  { id: 'd-jobs', label: 'Hiring-market evidence', x: 300, y: 412, skills: ['engineering-job-market-intelligence'] },
  { id: 'd-re', label: 'Interoperability analysis', x: 664, y: 168, skills: ['defensive-reverse-engineering'] },
  { id: 'd-3d', label: '3D & additive production', x: 664, y: 412, skills: ['spatial-3d-production-engineering'] },
  { id: 'd-geo', label: 'Geometry & numerics', x: 622, y: 92, skills: ['computational-geometry-engineering', 'spatial-3d-production-engineering'] },
  { id: 'd-bim', label: 'Heritage & BIM', x: 622, y: 490, skills: ['architecture-and-built-heritage-research', 'computational-geometry-engineering'] },
  { id: 'd-local', label: 'Local model runtimes', x: 706, y: 344, skills: ['local-model-runtime-engineering'] },
  { id: 'd-gov', label: 'Multi-agent governance', x: 342, y: 290, skills: ['agent-research-director'] },
  { id: 'd-supply', label: 'Skill supply chain', x: 618, y: 236, skills: ['agent-research-director', 'local-model-runtime-engineering'] },
  // Science & models domains
  { id: 'd-games', label: 'Game reconstruction', x: 262, y: 560, skills: ['game-reconstruction-engineering'] },
  { id: 'd-openmodels', label: 'Open-model landscape', x: 700, y: 536, skills: ['ai-open-model-research', 'local-model-runtime-engineering'] },
  { id: 'd-math', label: 'Formal sciences', x: 170, y: 660, skills: ['mathematics-research'] },
  { id: 'd-phys', label: 'Physical sciences', x: 390, y: 660, skills: ['physics-research', 'chemistry-research'] },
  { id: 'd-life', label: 'Life sciences', x: 660, y: 660, skills: ['biology-research'] },
  { id: 'd-history', label: 'History of science', x: 850, y: 660, skills: ['science-history-research'] },
];

const DOMAIN_FILTERS = [{ id: 'all', label: 'All domains' }, ...DOMAINS.map((d) => ({ id: d.id, label: d.label }))];

type Selection = { kind: 'skill'; id: string } | { kind: 'domain'; id: string } | null;

export default function Overview() {
  const [selection, setSelection] = useState<Selection>({
    kind: 'skill',
    id: 'agent-research-director',
  });
  const [domainFilter, setDomainFilter] = useState('all');

  const skillById = useMemo(
    () => Object.fromEntries(SKILL_PACKAGES.map((s) => [s.id, s])),
    [],
  );

  const visibleSkills = useMemo(() => {
    if (domainFilter === 'all') return new Set(SKILL_PACKAGES.map((s) => s.id));
    const d = DOMAINS.find((d) => d.id === domainFilter);
    return new Set(d ? d.skills : []);
  }, [domainFilter]);

  const selectedSkill =
    selection?.kind === 'skill' ? skillById[selection.id] : null;
  const selectedDomain =
    selection?.kind === 'domain' ? DOMAINS.find((d) => d.id === selection.id) : null;

  const isDimmed = (skillId: string) => !visibleSkills.has(skillId);

  const select = (sel: Selection) => setSelection(sel);
  const onNodeKey = (e: React.KeyboardEvent, sel: NonNullable<Selection>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      select(sel);
    }
  };

  const edges = DOMAINS.flatMap((d) =>
    d.skills.map((sid) => ({ d, s: SKILL_POS[sid], sid })),
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-8 md:py-12">
      {/* Editorial intro — left-aligned, no centered hero */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--mustard))]">
            Research atlas · verified snapshots
          </p>
          <h1 className="text-balance text-3xl font-extrabold leading-tight tracking-tight md:text-5xl">
            An evidence atlas for engineering organizations, agent skills, and
            the public hiring market
          </h1>
          <p className="prose-evidence mt-4 max-w-3xl text-base text-[hsl(var(--ink-soft))] md:text-lg">
            This atlas assembles verified, dated snapshots: a{' '}
            {ROLES.length}-role engineering taxonomy, {RESOURCES.length} curated
            learning resources, the public agent-skill ecosystem,{' '}
            {JOBS.recordCount.toLocaleString('en-US')} collected job records, a
            defensive reverse-engineering evidence base, and a seven-agent
            scientific research and open-model library. Every figure is
            computed from the underlying records; every external claim links to
            its source.
          </p>
        </div>
        <div className="panel-dark p-5">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-[hsl(42_78%_55%)]">
            Corpus at a glance
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Stat dark value={ROLES.length} label="Roles mapped" />
            <Stat dark value={RESOURCES.length} label="Resources curated" />
            <Stat dark value={SKILL_PACKAGES.length} label="Skill packages" />
            <Stat dark value={JOBS.recordCount} label="Verified job records" />
          </div>
          <p className="prose-evidence mt-4 text-xs text-[hsl(var(--dark-ink-soft))]">
            Counts are computed from the bundled datasets at build time, not
            typed by hand.
          </p>
        </div>
      </div>

      <div className="rule my-10" />

      {/* Constellation */}
      <SectionHeader
        kicker="Chapter 01 · Constellation"
        title="Fifteen skill packages, one coordinated system"
      >
        Select a package or domain node — by pointer or keyboard — to read its
        evidence brief. The director package coordinates; specialists execute
        under delegation contracts. An accessible list follows the graph.
      </SectionHeader>

      <div
        className="mb-4 flex flex-wrap border-b border-[hsl(var(--line))]"
        role="group"
        aria-label="Filter constellation by domain"
      >
        {DOMAIN_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className="tab-control text-xs"
            aria-pressed={domainFilter === f.id}
            onClick={() => setDomainFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="panel-dark overflow-hidden p-2 md:p-4">
          <svg
            viewBox="0 0 960 800"
            role="group"
            aria-label="Network of fifteen skill packages and their domains"
            className="h-auto w-full"
          >
            {/* edges */}
            {edges.map(({ d, s, sid }) => {
              const dim = isDimmed(sid);
              const active =
                (selection?.kind === 'skill' && selection.id === sid) ||
                (selection?.kind === 'domain' && selection.id === d.id);
              return (
                <line
                  key={`${d.id}-${sid}`}
                  x1={d.x}
                  y1={d.y}
                  x2={s.x}
                  y2={s.y}
                  stroke={active ? 'hsl(42 30% 85%)' : 'hsl(40 14% 32%)'}
                  strokeWidth={active ? 2 : 1}
                  opacity={dim ? 0.15 : 1}
                />
              );
            })}
            {/* director coordination edges */}
            {SKILL_PACKAGES.filter((s) => s.id !== 'agent-research-director').map(
              (s) => {
                const p = SKILL_POS[s.id];
                const dim = isDimmed(s.id);
                return (
                  <line
                    key={`dir-${s.id}`}
                    x1={480}
                    y1={290}
                    x2={p.x}
                    y2={p.y}
                    stroke="hsl(42 78% 45%)"
                    strokeWidth={1}
                    strokeDasharray="3 5"
                    opacity={dim ? 0.1 : 0.45}
                  />
                );
              },
            )}

            {/* domain nodes */}
            {DOMAINS.map((d) => {
              const dim = domainFilter !== 'all' && domainFilter !== d.id;
              const selected = selection?.kind === 'domain' && selection.id === d.id;
              return (
                <g
                  key={d.id}
                  transform={`translate(${d.x},${d.y})`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selected}
                  aria-label={`Domain: ${d.label}`}
                  opacity={dim ? 0.25 : 1}
                  style={{ cursor: 'pointer' }}
                  onClick={() => select({ kind: 'domain', id: d.id })}
                  onMouseEnter={() => select({ kind: 'domain', id: d.id })}
                  onFocus={() => select({ kind: 'domain', id: d.id })}
                  onKeyDown={(e) => onNodeKey(e, { kind: 'domain', id: d.id })}
                >
                  <rect
                    x={-10}
                    y={-10}
                    width={20}
                    height={20}
                    transform="rotate(45)"
                    fill={selected ? 'hsl(42 30% 90%)' : 'hsl(36 15% 15%)'}
                    stroke="hsl(42 20% 65%)"
                    strokeWidth={selected ? 2 : 1}
                  />
                  <text
                    y={26}
                    textAnchor="middle"
                    fill="hsl(42 20% 72%)"
                    fontSize={12}
                    fontFamily="Manrope, sans-serif"
                    fontWeight={600}
                  >
                    {d.label}
                  </text>
                </g>
              );
            })}

            {/* skill nodes */}
            {SKILL_PACKAGES.map((s) => {
              const p = SKILL_POS[s.id];
              const dim = isDimmed(s.id);
              const selected = selection?.kind === 'skill' && selection.id === s.id;
              const r = s.id === 'agent-research-director' ? 40 : 30;
              return (
                <g
                  key={s.id}
                  transform={`translate(${p.x},${p.y})`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selected}
                  aria-label={`Skill package: ${s.name}`}
                  opacity={dim ? 0.2 : 1}
                  style={{ cursor: 'pointer' }}
                  onClick={() => select({ kind: 'skill', id: s.id })}
                  onMouseEnter={() => select({ kind: 'skill', id: s.id })}
                  onFocus={() => select({ kind: 'skill', id: s.id })}
                  onKeyDown={(e) => onNodeKey(e, { kind: 'skill', id: s.id })}
                >
                  <circle
                    r={r}
                    fill={selected ? ACCENT_HSL[s.accent] : 'hsl(36 15% 15%)'}
                    stroke={ACCENT_HSL[s.accent]}
                    strokeWidth={selected ? 3 : 2}
                  />
                  <circle r={r - 9} fill="none" stroke={selected ? 'hsl(36 18% 10%)' : ACCENT_HSL[s.accent]} strokeWidth={1} opacity={0.6} />
                  <text
                    y={r + 18}
                    textAnchor="middle"
                    fill={selected ? 'hsl(42 30% 92%)' : 'hsl(42 20% 72%)'}
                    fontSize={13}
                    fontWeight={700}
                    fontFamily="Manrope, sans-serif"
                  >
                    {s.shortName}
                  </text>
                </g>
              );
            })}
          </svg>
          <p className="px-2 pb-2 text-xs text-[hsl(var(--dark-ink-soft))]">
            Solid edges bind a package to a knowledge domain. Dashed edges are
            director coordination links.
          </p>
        </div>

        {/* Evidence / detail pane */}
        <div
          className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-5"
          aria-live="polite"
        >
          {selectedSkill ? (
            <div>
              <span className={`chip chip-${selectedSkill.accent}`}>
                Skill package
              </span>
              <h3 className="mt-3 text-xl font-extrabold tracking-tight">
                {selectedSkill.name}
              </h3>
              <p className="mt-1 text-sm font-semibold text-[hsl(var(--ink-soft))]">
                {selectedSkill.tagline}
              </p>
              <p className="prose-evidence mt-3 text-sm">
                {selectedSkill.description}
              </p>
              <div className="rule my-4" />
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[hsl(var(--ink-soft))]">
                Produces
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {selectedSkill.outputs.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
              <p className="mb-2 mt-4 text-xs font-bold uppercase tracking-wider text-[hsl(var(--ink-soft))]">
                Gates & limits
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {selectedSkill.gates.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            </div>
          ) : selectedDomain ? (
            <div>
              <span className="chip chip-neutral">Domain node</span>
              <h3 className="mt-3 text-xl font-extrabold tracking-tight">
                {selectedDomain.label}
              </h3>
              <p className="prose-evidence mt-3 text-sm">
                Connected to{' '}
                {selectedDomain.skills.length > 1 ? 'packages' : 'package'}:{' '}
                {selectedDomain.skills
                  .map((id) => skillById[id]?.name ?? id)
                  .join('; ')}
                .
              </p>
              <div className="rule my-4" />
              <ul className="space-y-2">
                {selectedDomain.skills.map((id) => (
                  <li key={id}>
                    <button
                      type="button"
                      className="btn w-full justify-start px-3 text-left text-sm"
                      onClick={() => select({ kind: 'skill', id })}
                    >
                      Open {skillById[id]?.shortName ?? id} brief
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      {/* Accessible list alternative */}
      <div className="mt-8">
        <SubHead>Package index — list alternative</SubHead>
        <ul className="border-t border-[hsl(var(--ink))]">
          {SKILL_PACKAGES.map((s, i) => {
            const active = selection?.kind === 'skill' && selection.id === s.id;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  className={`flex min-h-[44px] w-full items-center gap-3 border-b border-[hsl(var(--line))] border-l-2 px-3 py-2 text-left transition-colors ${
                    active
                      ? 'border-l-[hsl(var(--ink))] font-bold'
                      : 'border-l-transparent hover:bg-[hsl(var(--paper-raised))]'
                  }`}
                  aria-pressed={active}
                  onClick={() => select({ kind: 'skill', id: s.id })}
                >
                  <span className="mono w-6 shrink-0 text-xs text-[hsl(var(--ink-soft))]">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: ACCENT_HSL[s.accent] }}
                    aria-hidden="true"
                  />
                  <span>
                    <span className="block text-sm font-bold">{s.name}</span>
                    <span className="block text-xs font-normal text-[hsl(var(--ink-soft))]">
                      {s.tagline}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="rule my-10" />

      {/* Team types and interactions */}
      <SectionHeader
        kicker="Chapter 01 · Team design"
        title="Team types and how they interact"
      >
        The organization model behind the role directory uses four team types
        and three interaction modes. Teams own value streams or capabilities;
        interactions are explicit, time-bounded choices — not org-chart
        accidents.
      </SectionHeader>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="panel-dark p-5">
          <SubHead>Four team types</SubHead>
          <dl className="space-y-4 text-sm">
            {[
              ['Stream-aligned', 'Owns a product or value stream end to end; the default team type. Most of the 109 mapped roles live here.'],
              ['Platform', 'Runs internal services (CI, data platform, identity) as products so stream teams move faster with less cognitive load.'],
              ['Enabling', 'Time-bounded specialists that grow capability in other teams — security champions, accessibility coaches, geometry reviewers.'],
              ['Complicated-subsystem', 'Owns components needing scarce deep expertise: rendering engines, solvers, firmware, numerical kernels.'],
            ].map(([t, d]) => (
              <div key={t}>
                <dt className="font-bold text-[hsl(42_78%_55%)]">{t}</dt>
                <dd className="prose-evidence mt-1 text-[hsl(var(--dark-ink-soft))]">{d}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="space-y-4">
          <div className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-5">
            <SubHead>Three interaction modes</SubHead>
            <dl className="space-y-4 text-sm">
              {[
                ['Collaboration', 'Two teams work jointly on a discovery or migration; expensive, so it is time-bounded with a stated exit.'],
                ['X-as-a-service', 'A platform or subsystem is consumed through a documented interface with clear ownership and SLAs.'],
                ['Facilitation', 'An enabling team helps another team adopt a practice, then steps back — capability transfers, not dependency.'],
              ].map(([t, d]) => (
                <div key={t}>
                  <dt className="font-bold">{t}</dt>
                  <dd className="prose-evidence mt-1 text-[hsl(var(--ink-soft))]">{d}</dd>
                </div>
              ))}
            </dl>
          </div>
          <EvidenceNote title="How to read this atlas" accent="sage">
            Roles describe missions and interfaces, not headcount targets. Job
            records are a dated snapshot of public postings, not market truth.
            Reverse-engineering counts are source records, not a census. Each
            view states its own limits next to the numbers.
          </EvidenceNote>
        </div>
      </div>
    </div>
  );
}

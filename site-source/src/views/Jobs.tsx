import { useMemo, useState } from 'react';
import { ExtLink } from '@/components/ExtLink';
import { EvidenceNote, SectionHeader, SubHead } from '@/components/SectionHeader';
import { Stat } from '@/components/Stat';
import { JOBS } from '@/data/jobs';
import { LEADS } from '@/data/leads';
import { fmt } from '@/lib/format';

const FAMILY_LABELS: Record<string, string> = {
  backend_fullstack: 'Backend / full-stack',
  technical_product_program: 'Technical product & program',
  ai_ml: 'AI / ML engineering',
  data_analytics: 'Data & analytics',
  cybersecurity: 'Cybersecurity',
  platform_sre_infra: 'Platform, SRE & infra',
  quality_engineering: 'Quality engineering',
  ui_ux_design_research: 'UI/UX & design research',
  research_science: 'Research science',
  frontend_mobile: 'Frontend & mobile',
  game_engineering_art: 'Game engineering & art',
  documentation_content: 'Documentation & content',
  other_or_unclear: 'Other / unclear',
};

const COVERAGE: {
  company: string;
  source: string;
  status: string;
  records: string;
  note: string;
}[] = [
  {
    company: 'Amazon',
    source: 'amazon.jobs public search JSON',
    status: 'Collected',
    records: `${fmt(JOBS.companies['Amazon'])} records`,
    note: 'robots.txt checked and allowed; documented public endpoint; low request rate. Counts are a dated snapshot.',
  },
  {
    company: 'Rockstar Games',
    source: 'Greenhouse public job board',
    status: 'Collected',
    records: `${fmt(JOBS.companies['Rockstar Games'])} records`,
    note: 'Full public board at retrieval time; small board, listed in full below.',
  },
  {
    company: 'Meta',
    source: 'metacareers.com',
    status: 'Restricted — not collected',
    records: `${LEADS.filter((l) => l.company === 'Meta').length} indexed samples`,
    note: 'Automated collection is prohibited without permission; only search-index samples of official postings are referenced, and they are not live-verified.',
  },
  {
    company: 'Netflix',
    source: 'jobs.netflix.com',
    status: 'Restricted — not collected',
    records: `${LEADS.filter((l) => l.company === 'Netflix').length} indexed/indirect leads`,
    note: 'No compliant public feed was established during this pass; leads come from indexes and mirrors and are labeled accordingly.',
  },
  {
    company: 'Google',
    source: 'careers.google.com',
    status: 'Restricted — not collected',
    records: `${LEADS.filter((l) => l.company === 'Google').length} indexed samples`,
    note: 'No compliant bulk access path in this pass; a small number of indexed official samples are listed as leads only.',
  },
];

export default function Jobs() {
  const families = useMemo(() => JOBS.titleFamilyCounts['All'] ?? {}, []);
  const sortedFamilies = useMemo(
    () => Object.entries(families).sort((a, b) => b[1] - a[1]),
    [families],
  );
  const [family, setFamily] = useState<string>(sortedFamilies[0]?.[0] ?? 'ai_ml');
  const maxCount = sortedFamilies[0]?.[1] ?? 1;
  const skillInfo = JOBS.skillsByTitleFamily[family];
  const retrieved = JOBS.retrievedAt.slice(0, 10);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-8 md:py-12">
      <SectionHeader kicker="Chapter 04 · Jobs evidence" title="Verified hiring records, dated and sourced">
        {fmt(JOBS.recordCount)} public job records retrieved {retrieved}: Amazon
        via its public search endpoint and Rockstar Games via its public
        Greenhouse board. Role families and skill mentions are deterministic
        extraction signals from posting text — not employer-certified labels.
      </SectionHeader>

      <div className="panel-dark mb-10 grid grid-cols-2 gap-4 p-5 md:grid-cols-4">
        <Stat dark value={JOBS.recordCount} label="Total records" note={`retrieved ${retrieved}`} />
        <Stat dark value={JOBS.companies['Amazon']} label="Amazon records" note="14 public categories" />
        <Stat dark value={JOBS.companies['Rockstar Games']} label="Rockstar records" note="full public board" />
        <Stat dark value={LEADS.length} label="Indexed leads" note="not live-verified" />
      </div>

      {/* Amazon categories */}
      <SubHead>Amazon — {Object.keys(JOBS.amazonCategoryCounts).length} selected public categories</SubHead>
      <p className="prose-evidence mb-4 max-w-3xl text-sm text-[hsl(var(--ink-soft))]">
        The Amazon sweep covers the {Object.keys(JOBS.amazonCategoryCounts).length}{' '}
        engineering-relevant public categories below — not every job Amazon
        lists. Representative links are the first records of the snapshot in
        each category.
      </p>
      <div className="overflow-x-auto border border-[hsl(var(--line))]">
        <table className="table-cat min-w-[640px]">
          <thead>
            <tr className="border-b border-[hsl(var(--line))] text-left">
              <th scope="col" className="px-3 py-2 text-xs font-bold uppercase tracking-wider">Category</th>
              <th scope="col" className="px-3 py-2 text-right text-xs font-bold uppercase tracking-wider">Records</th>
              <th scope="col" className="px-3 py-2 text-xs font-bold uppercase tracking-wider">Representative postings</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(JOBS.amazonCategoryCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, count]) => (
                <tr key={cat} className="border-b border-[hsl(var(--line))] align-top last:border-0">
                  <td className="px-3 py-2 font-semibold">{cat}</td>
                  <td className="mono px-3 py-2 text-right font-bold">{fmt(count)}</td>
                  <td className="px-3 py-2">
                    <ul className="space-y-1">
                      {(JOBS.amazonSamples[cat] ?? []).map((s) => (
                        <li key={s.url}>
                          <ExtLink href={s.url}>{s.title}</ExtLink>
                          <span className="ml-1 text-xs text-[hsl(var(--ink-soft))]">
                            {s.locations[0] ?? ''}{s.postedDate ? ` · ${s.postedDate}` : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="rule my-10" />

      {/* Rockstar full board */}
      <SubHead>Rockstar Games — full public board ({JOBS.rockstarBoard.length} roles)</SubHead>
      <div className="overflow-x-auto border border-[hsl(var(--line))]">
        <table className="table-cat min-w-[640px]">
          <thead>
            <tr className="border-b border-[hsl(var(--line))] text-left">
              <th scope="col" className="px-3 py-2 text-xs font-bold uppercase tracking-wider">Title</th>
              <th scope="col" className="px-3 py-2 text-xs font-bold uppercase tracking-wider">Department</th>
              <th scope="col" className="px-3 py-2 text-xs font-bold uppercase tracking-wider">Location</th>
            </tr>
          </thead>
          <tbody>
            {JOBS.rockstarBoard.map((j) => (
              <tr key={j.url} className="border-b border-[hsl(var(--line))] align-top last:border-0">
                <td className="px-3 py-2"><ExtLink href={j.url}>{j.title}</ExtLink></td>
                <td className="px-3 py-2">{j.department || '—'}</td>
                <td className="px-3 py-2">{j.locations.join('; ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rule my-10" />

      {/* Title families + skills */}
      <SubHead>Title-family signals across all {fmt(JOBS.recordCount)} records</SubHead>
      <p className="prose-evidence mb-4 max-w-3xl text-sm text-[hsl(var(--ink-soft))]">
        Families are multi-label title/category signals: one posting can enter
        several families, so family counts do not sum to{' '}
        {fmt(JOBS.recordCount)} and must not be read as market-demand rankings.
        Content-based counts (full posting text) are a separate signal and are
        not mixed with the title-based figures below.
      </p>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="panel-dark p-5">
          <ul className="space-y-3">
            {sortedFamilies.map(([key, count]) => (
              <li key={key}>
                <button
                  type="button"
                  className="block w-full text-left"
                  aria-pressed={family === key}
                  onClick={() => setFamily(key)}
                >
                  <span className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                    <span className={family === key ? 'font-bold text-[hsl(42_78%_55%)]' : 'font-medium'}>
                      {FAMILY_LABELS[key] ?? key}
                    </span>
                    <span className="mono font-bold">{fmt(families[key])}</span>
                  </span>
                  <span className="block h-2 w-full bg-[hsl(36_15%_18%)]" aria-hidden="true">
                    <span
                      className="block h-full"
                      style={{
                        width: `${Math.max(1.5, (count / maxCount) * 100)}%`,
                        background: family === key ? 'hsl(42 78% 45%)' : 'hsl(219 46% 58%)',
                      }}
                    />
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-[hsl(var(--dark-ink-soft))]">
            Multi-label title/category signals; counts overlap and do not sum
            to the record total. Select a family to read its skill mentions.
          </p>
        </div>
        <div className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-5" aria-live="polite">
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-[hsl(var(--ink-soft))]">
            Skill mentions
          </p>
          <h4 className="text-lg font-extrabold tracking-tight">
            {FAMILY_LABELS[family] ?? family}
          </h4>
          <p className="mono mt-1 text-xs text-[hsl(var(--ink-soft))]">
            {skillInfo ? `${fmt(skillInfo.jobCount)} records in family` : 'No records'}
          </p>
          {skillInfo ? (
            <ol className="mt-3 space-y-1 text-sm">
              {skillInfo.topSkills.slice(0, 10).map(([skill, n]) => (
                <li key={skill} className="flex items-baseline justify-between gap-2 border-b border-[hsl(var(--line))] pb-1">
                  <span>{skill}</span>
                  <span className="mono font-bold">{fmt(n)}</span>
                </li>
              ))}
            </ol>
          ) : null}
          <p className="prose-evidence mt-3 text-xs italic text-[hsl(var(--ink-soft))]">
            Skill mentions count postings whose text mentions a skill; they are
            demand signals within this snapshot, not certification requirements
            or market share.
          </p>
        </div>
      </div>

      <div className="rule my-10" />

      {/* Coverage */}
      <SubHead>Company & source coverage</SubHead>
      <div className="overflow-x-auto border border-[hsl(var(--line))]">
        <table className="table-cat min-w-[640px]">
          <thead>
            <tr className="border-b border-[hsl(var(--line))] text-left">
              <th scope="col" className="px-3 py-2 text-xs font-bold uppercase tracking-wider">Company</th>
              <th scope="col" className="px-3 py-2 text-xs font-bold uppercase tracking-wider">Source</th>
              <th scope="col" className="px-3 py-2 text-xs font-bold uppercase tracking-wider">Status</th>
              <th scope="col" className="px-3 py-2 text-xs font-bold uppercase tracking-wider">Records</th>
              <th scope="col" className="px-3 py-2 text-xs font-bold uppercase tracking-wider">Note</th>
            </tr>
          </thead>
          <tbody>
            {COVERAGE.map((c) => (
              <tr key={c.company} className="border-b border-[hsl(var(--line))] align-top last:border-0">
                <td className="px-3 py-2 font-bold">{c.company}</td>
                <td className="px-3 py-2">{c.source}</td>
                <td className="px-3 py-2">
                  <span className={`chip ${c.status === 'Collected' ? 'chip-sage' : 'chip-alert'}`}>{c.status}</span>
                </td>
                <td className="mono px-3 py-2">{c.records}</td>
                <td className="prose-evidence px-3 py-2 text-xs">{c.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rule my-10" />

      {/* Indexed leads */}
      <SubHead>Indexed & indirect leads — {LEADS.length} records, not live</SubHead>
      <EvidenceNote title="Not a live board" accent="cornflower">
        These {LEADS.length} leads come from search indexes and mirrors, not
        from a compliant live collection. Live status is not established for
        any of them; treat each as a pointer to verify on the official site.
        Companies are listed side by side for coverage transparency — this is
        not a cross-company ranking.
      </EvidenceNote>
      <div className="mt-4 overflow-x-auto border border-[hsl(var(--line))]">
        <table className="table-cat min-w-[640px]">
          <thead>
            <tr className="border-b border-[hsl(var(--line))] text-left">
              <th scope="col" className="px-3 py-2 text-xs font-bold uppercase tracking-wider">Company</th>
              <th scope="col" className="px-3 py-2 text-xs font-bold uppercase tracking-wider">Title</th>
              <th scope="col" className="px-3 py-2 text-xs font-bold uppercase tracking-wider">Family</th>
              <th scope="col" className="px-3 py-2 text-xs font-bold uppercase tracking-wider">Location</th>
              <th scope="col" className="px-3 py-2 text-xs font-bold uppercase tracking-wider">Evidence</th>
              <th scope="col" className="px-3 py-2 text-xs font-bold uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {LEADS.map((l) => (
              <tr key={l.officialUrl + l.title} className="border-b border-[hsl(var(--line))] align-top last:border-0">
                <td className="px-3 py-2 font-bold">{l.company}</td>
                <td className="px-3 py-2"><ExtLink href={l.officialUrl}>{l.title}</ExtLink></td>
                <td className="px-3 py-2">{l.family}</td>
                <td className="px-3 py-2">{l.location}</td>
                <td className="px-3 py-2">
                  <span className={`chip ${l.evidenceClass === 'indirect_mirror' ? 'chip-mustard' : 'chip-cornflower'}`}>
                    {l.evidenceClass === 'indirect_mirror' ? 'Indirect mirror' : 'Indexed official sample'}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className="chip chip-alert">Not live</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8">
        <EvidenceNote title="Snapshot limitations" accent="mustard">
          <ul className="list-disc space-y-1 pl-5">
            {JOBS.limitations.map((l) => (
              <li key={l}>{l}</li>
            ))}
            <li>Amazon and Rockstar figures describe different boards and categories; they are not ranked against each other or against restricted companies.</li>
          </ul>
        </EvidenceNote>
      </div>
    </div>
  );
}

import { ExtLink } from '@/components/ExtLink';
import { EvidenceNote, SectionHeader, SubHead } from '@/components/SectionHeader';
import { AGENT_REPOS, COMMUNITIES, SKILL_ENTRIES, TOPIC_SEARCHES } from '@/data/ecosystem';
import { JOBS } from '@/data/jobs';
import { LEADS } from '@/data/leads';
import { PAPERS } from '@/data/papers';
import { RESOURCES } from '@/data/resources';
import { REVERSE } from '@/data/reverse';
import { ROLES } from '@/data/roles';
import { SCIENCE_COUNTS, SCIENCE_INDEX } from '@/data/science';
import { SKILL_PACKAGES } from '@/data/skills';
import { fmt } from '@/lib/format';

interface DictRow {
  dataset: string;
  records: string;
  source: string;
  retrieved: string;
  use: string;
}

const ACCENT_TEXT: Record<string, string> = {
  mustard: 'text-[hsl(38_80%_32%)]',
  sage: 'text-[hsl(82_30%_30%)]',
  cornflower: 'text-[hsl(219_50%_38%)]',
};

export default function Methodology() {
  const dictionary: DictRow[] = [
    {
      dataset: 'Role directory',
      records: `${fmt(ROLES.length)} roles`,
      source: 'SFIA 9, NICE framework, Google SRE workbook, W3C ARRM, NIST AI RMF, published career frameworks, verified job postings',
      retrieved: '2026-11-20',
      use: 'Reference role taxonomy: missions, outputs, skills, senior scope, interfaces',
    },
    {
      dataset: 'Resource library',
      records: `${fmt(RESOURCES.length)} resources`,
      source: 'Manual curation against official documentation',
      retrieved: '2026-11-20',
      use: 'Learning paths with level, access, license, and caveat notes',
    },
    {
      dataset: 'Agent ecosystem',
      records: `${fmt(AGENT_REPOS.length)} repositories, ${fmt(SKILL_ENTRIES.length)} skills/plugins, ${fmt(TOPIC_SEARCHES.length)} topic searches, ${fmt(COMMUNITIES.length)} communities`,
      source: 'GitHub repositories and official vendor documentation',
      retrieved: '2026-11-20',
      use: 'Lifecycle, license, and official-status mapping of the agent-skill ecosystem',
    },
    {
      dataset: 'Jobs evidence',
      records: `${fmt(JOBS.recordCount)} records (${fmt(JOBS.companies['Amazon'])} Amazon + ${fmt(JOBS.companies['Rockstar Games'])} Rockstar)`,
      source: 'amazon.jobs public search JSON; Rockstar public Greenhouse board',
      retrieved: JOBS.retrievedAt.slice(0, 10),
      use: 'Title-family counts, skill-mention signals, category coverage',
    },
    {
      dataset: 'Indexed leads',
      records: `${fmt(LEADS.length)} leads`,
      source: 'Search indexes and mirrors of official postings',
      retrieved: '2026-11-20',
      use: 'Restricted-company pointers; none live-verified',
    },
    {
      dataset: 'Paper catalog',
      records: `${fmt(PAPERS.length)} papers after URL dedupe`,
      source: 'Three scholar collections: ReAct, multi-agent systems, agent-skill security',
      retrieved: '2026-11-20',
      use: 'Research grounding with publication/preprint wording preserved',
    },
    {
      dataset: 'Reverse-engineering base',
      records: `${fmt(REVERSE.analysis.sourceOccurrences)} occurrences, ${fmt(REVERSE.analysis.uniqueProjects)} unique projects, ${REVERSE.analysis.clusterCount} clusters`,
      source: 'Five sources: interoperability catalog, game reconstruction catalogs, curated REA catalog, automated repository index, topic snapshot',
      retrieved: `${REVERSE.interoperability.updated} to ${REVERSE.topicSnapshot.retrievedAt.slice(0, 10)}`,
      use: 'Tiered evidence base for defensive RE research; not a census',
    },
    {
      dataset: 'Science & model library',
      records: `${SCIENCE_COUNTS.agents} agents, ${fmt(SCIENCE_COUNTS.resourceOccurrences)} resource occurrences (${fmt(SCIENCE_COUNTS.uniqueResourceUrls)} unique URLs), ${SCIENCE_COUNTS.modelEntries} model entries, ${SCIENCE_COUNTS.evaluationRows} evaluation rows, ${fmt(SCIENCE_COUNTS.gameCatalogRows)} game catalog rows`,
      source: 'Four domain research libraries, game-reconstruction catalog, four SOTA domain surveys, and a registry-verified model snapshot; compiled into a ten-sheet workbook and machine-readable index',
      retrieved: SCIENCE_INDEX.compiled,
      use: 'Scientific domain coverage, evidence-labeled open-model landscape, [V]/[I]/[R] tier semantics; snapshot, not a standing reference',
    },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-8 md:py-12">
      <SectionHeader kicker="Chapter 08 · Methodology" title="How this atlas was built and where it stops">
        Every figure in this atlas is computed at build time from dated source
        records. This page is the data dictionary, the provenance log, and the
        list of limitations — read it before citing any number.
      </SectionHeader>

      <SubHead>Data dictionary</SubHead>
      <div className="overflow-x-auto border border-[hsl(var(--line))]">
        <table className="table-cat min-w-[640px]">
          <thead>
            <tr className="border-b border-[hsl(var(--line))] text-left">
              <th scope="col" className="px-3 py-2 text-xs font-bold uppercase tracking-wider">Dataset</th>
              <th scope="col" className="px-3 py-2 text-xs font-bold uppercase tracking-wider">Records</th>
              <th scope="col" className="px-3 py-2 text-xs font-bold uppercase tracking-wider">Source</th>
              <th scope="col" className="px-3 py-2 text-xs font-bold uppercase tracking-wider">Retrieved</th>
              <th scope="col" className="px-3 py-2 text-xs font-bold uppercase tracking-wider">Use in atlas</th>
            </tr>
          </thead>
          <tbody>
            {dictionary.map((d) => (
              <tr key={d.dataset} className="border-b border-[hsl(var(--line))] align-top last:border-0">
                <td className="px-3 py-2 font-bold">{d.dataset}</td>
                <td className="mono px-3 py-2">{d.records}</td>
                <td className="prose-evidence px-3 py-2 text-xs">{d.source}</td>
                <td className="mono px-3 py-2 text-xs">{d.retrieved}</td>
                <td className="prose-evidence px-3 py-2 text-xs">{d.use}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rule my-10" />

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <SubHead>Provenance & coverage</SubHead>
          <ul className="space-y-3 text-sm">
            <li className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-3">
              <strong>Source policy.</strong> Collection checks robots.txt and
              site terms per source, uses documented public endpoints at low
              request rates, and stops on authentication walls, 401/403, or
              disallow rules. No stealth fingerprints, residential proxies,
              CAPTCHA solving, or private endpoints.
            </li>
            <li className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-3">
              <strong>Restricted companies.</strong> Meta, Google, and Netflix
              postings were not collected in bulk; only indexed or mirrored
              samples appear, clearly labeled as not live.
            </li>
            <li className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-3">
              <strong>Deduplication.</strong> Papers are deduplicated by
              canonical URL. Reverse-engineering projects are normalized across
              five sources; {fmt(REVERSE.analysis.sourceOccurrences)} occurrences
              resolve to {fmt(REVERSE.analysis.uniqueProjects)} unique projects.
            </li>
            <li className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-3">
              <strong>Deterministic signals.</strong> Role families, skill
              mentions, and seniority are extracted by fixed rules from posting
              text and are reproducible from the same snapshot.
            </li>
          </ul>
        </div>
        <div>
          <SubHead>Research limitations</SubHead>
          <EvidenceNote title="Read before citing" accent="mustard">
            <ul className="list-disc space-y-2 pl-5">
              <li>All figures are dated snapshots; a record proves what a source returned at retrieval time, not later availability.</li>
              <li>The reverse-engineering base is not a census: curated selection, automated scans, and star-ranked samples each carry known biases.</li>
              <li>Star, fork, and citation counters are attention signals, not adoption or quality evidence.</li>
              <li>Skill mentions in job postings are text-extraction signals, not employer-certified requirements.</li>
              <li>Amazon category coverage is a selection of {Object.keys(JOBS.amazonCategoryCounts).length} public categories, not the whole board; restricted companies are absent from collected counts entirely.</li>
              <li>Clusters are exploratory TF-IDF/NMF themes over names and descriptions — not a validated taxonomy.</li>
              <li>License fields reflect detected files at retrieval; a blank marker means unknown/not collected, and grants no reuse rights either way.</li>
              <li>The science & model library is a {SCIENCE_INDEX.compiled} snapshot: evidence labels are propagated verbatim, [V] vendor-reported claims are never independently verified, and no universal SOTA ranking exists — leadership claims stay scoped to benchmark, date, harness, license tier, and hardware budget.</li>
            </ul>
          </EvidenceNote>
        </div>
      </div>

      <div className="rule my-10" />

      <SubHead>The {SKILL_PACKAGES.length} runtime skill packages</SubHead>
      <div className="grid gap-4 md:grid-cols-2">
        {SKILL_PACKAGES.map((s) => (
          <article key={s.id} className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-5">
            <p className={`text-xs font-bold uppercase tracking-[0.18em] ${ACCENT_TEXT[s.accent]}`}>
              {s.shortName}
            </p>
            <h3 className="mt-1 text-lg font-extrabold tracking-tight">{s.name}</h3>
            <p className="prose-evidence mt-2 text-sm">{s.description}</p>
            <div className="rule my-3" />
            <p className="text-xs text-[hsl(var(--ink-soft))]">
              <span className="font-bold">Domains:</span> {s.domains.join(' · ')}
            </p>
            <p className="mt-1 text-xs text-[hsl(var(--ink-soft))]">
              <span className="font-bold">Key gates:</span> {s.gates[0]}
            </p>
          </article>
        ))}
      </div>

      <div className="rule my-10" />

      <SubHead>Build & reproduction</SubHead>
      <p className="prose-evidence max-w-3xl text-sm text-[hsl(var(--ink-soft))]">
        A local generator reads the raw Python/JSON/CSV inputs and emits typed
        static modules bundled with this site; the deployed app makes no
        network calls for data and ships no runtime Python. Framework sources
        referenced by the role directory include{' '}
        <ExtLink href="https://sfia-online.org/en/sfia-9">SFIA 9</ExtLink>, the{' '}
        <ExtLink href="https://niccs.cisa.gov/tools/nice-framework">NICE Workforce Framework</ExtLink>, the{' '}
        <ExtLink href="https://sre.google/workbook/table-of-contents/">Google SRE Workbook</ExtLink>, the{' '}
        <ExtLink href="https://www.w3.org/WAI/planning/arrm/">W3C ARRM</ExtLink>, and the{' '}
        <ExtLink href="https://www.nist.gov/itl/ai-risk-management-framework">NIST AI RMF</ExtLink>.
      </p>
    </div>
  );
}

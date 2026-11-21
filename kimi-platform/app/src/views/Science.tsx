import { ExtLink } from '@/components/ExtLink';
import { EvidenceNote, SectionHeader, SubHead } from '@/components/SectionHeader';
import { Stat } from '@/components/Stat';
import {
  EVIDENCE_TIERS,
  FRONTIER,
  OFFICIAL_RESOURCES,
  OPENNESS_SPECTRUM,
  SCIENCE_AGENTS,
  SCIENCE_COUNTS,
  SCIENCE_INDEX,
  SELECTION_WORKFLOW,
  SOURCE_REPORTS,
} from '@/data/science';
import { fmt } from '@/lib/format';

const ACCENT_TEXT: Record<string, string> = {
  mustard: 'text-[hsl(38_80%_32%)]',
  sage: 'text-[hsl(82_30%_30%)]',
  cornflower: 'text-[hsl(219_50%_38%)]',
};

const maxOccurrences = Math.max(
  ...SCIENCE_COUNTS.domainCoverage.map((d) => d.occurrences),
);

export default function Science() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-8 md:py-12">
      <SectionHeader
        kicker="Chapter 07 · Science & models"
        title="The scientific research and open-model library"
      >
        A {SCIENCE_AGENTS.length}-agent scientific research library compiled{' '}
        {SCIENCE_INDEX.compiled}: five domain researchers (mathematics,
        physics, chemistry, biology, science history), a game-reconstruction
        engineer, an AI open-model researcher, and the AI research-frontier
        trio (director, senior scientist, writer/reproducibility editor) —
        shipped as vetted skill packages alongside the eight engineering
        packages and the two specialist packages (architecture-database-backend
        and UI/UX research-design; ten scientific agents, unchanged).{' '}
        {fmt(SCIENCE_COUNTS.resourceOccurrences)} resource
        occurrences resolve to {fmt(SCIENCE_COUNTS.uniqueResourceUrls)} unique
        URLs; {SCIENCE_COUNTS.modelEntries} model entries carry inline evidence
        labels. Trust policy: {SCIENCE_INDEX.trustPolicy}
      </SectionHeader>

      <div className="panel-dark p-5">
        <p className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-[hsl(42_78%_55%)]">
          Library at a glance · verified {SCIENCE_INDEX.verificationDate}
        </p>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat dark value={SCIENCE_COUNTS.agents} label="Dedicated agents" />
          <Stat dark value={SCIENCE_COUNTS.skills} label="Skill packages total" />
          <Stat dark value={SCIENCE_COUNTS.resourceOccurrences} label="Resource occurrences" />
          <Stat dark value={SCIENCE_COUNTS.uniqueResourceUrls} label="Unique resource URLs" />
          <Stat dark value={SCIENCE_COUNTS.modelEntries} label="Model entries" />
          <Stat dark value={SCIENCE_COUNTS.evaluationRows} label="Evaluation rows" />
          <Stat dark value={SCIENCE_COUNTS.gameCatalogRows} label="Game catalog rows" />
          <Stat
            dark
            value={SCIENCE_COUNTS.modelEvidenceClasses.iIndependent}
            label="Independently measured [I]"
          />
        </div>
      </div>

      <div className="rule my-10" />

      {/* Ten agents */}
      <SubHead>{SCIENCE_AGENTS.length} dedicated agents</SubHead>
      <div className="grid gap-4 md:grid-cols-2">
        {SCIENCE_AGENTS.map((a) => (
          <article
            key={a.id}
            className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-5"
          >
            <p className={`text-xs font-bold uppercase tracking-[0.18em] ${ACCENT_TEXT[a.accent]}`}>
              {a.domain}
            </p>
            <h3 className="mt-1 text-lg font-extrabold tracking-tight">{a.name}</h3>
            <p className="prose-evidence mt-2 text-sm">{a.mission}</p>
            <div className="rule my-3" />
            <p className="text-xs text-[hsl(var(--ink-soft))]">
              <span className="font-bold">Skill package:</span>{' '}
              <span className="mono">{a.skill}</span>
            </p>
            <p className="mt-1 text-xs">
              <a
                className="ext-link"
                href={a.charter}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>Agent charter ({a.charter.split('/').pop()})</span>
              </a>
            </p>
          </article>
        ))}
      </div>

      <div className="rule my-10" />

      {/* Domain coverage */}
      <SubHead>Domain coverage</SubHead>
      <p className="prose-evidence mb-4 max-w-3xl text-sm text-[hsl(var(--ink-soft))]">
        Curated resource occurrences by domain, from the machine-readable index.
        Occurrences are source records, not a census; game reconstruction
        dominates because its catalogs were link-checked row by row.
      </p>
      <ul className="space-y-2">
        {SCIENCE_COUNTS.domainCoverage.map((d) => (
          <li key={d.domain} className="flex items-center gap-3">
            <span className="w-32 shrink-0 text-sm font-bold md:w-48">{d.domain}</span>
            <span className="min-w-0 flex-1" aria-hidden="true">
              <span
                className="block h-3 bg-[hsl(var(--mustard))]"
                style={{ width: `${Math.max(2, (d.occurrences / maxOccurrences) * 100)}%` }}
              />
            </span>
            <span className="mono shrink-0 text-xs text-[hsl(var(--ink-soft))]">
              {fmt(d.occurrences)}
            </span>
          </li>
        ))}
      </ul>

      <div className="rule my-10" />

      {/* Evidence tiers */}
      <SubHead>Evidence tiers — [V] / [I] / [R]</SubHead>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-3">
          {EVIDENCE_TIERS.map((t) => (
            <div
              key={t.label}
              className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-4"
            >
              <p className="text-sm">
                <span className="mono chip chip-mustard">{t.label}</span>{' '}
                <strong>{t.name}</strong>
              </p>
              <p className="prose-evidence mt-2 text-sm">{t.body}</p>
            </div>
          ))}
          <p className="mono text-xs text-[hsl(var(--ink-soft))]">
            Model evidence classes across {SCIENCE_COUNTS.modelEntries} entries:{' '}
            {SCIENCE_COUNTS.modelEvidenceClasses.vVendorOnly} vendor-only ·{' '}
            {SCIENCE_COUNTS.modelEvidenceClasses.vAndIMixed} mixed [V]+[I] ·{' '}
            {SCIENCE_COUNTS.modelEvidenceClasses.iIndependent} independent ·{' '}
            {SCIENCE_COUNTS.modelEvidenceClasses.rRegistry} registry-verified ·{' '}
            {SCIENCE_COUNTS.modelEvidenceClasses.unlabeled} unlabeled.
          </p>
        </div>
        <EvidenceNote title="There is no universal SOTA" accent="mustard">
          <p>
            Leadership is always scoped to a named benchmark, a date, a harness,
            a license tier, and a hardware budget. Rankings that flip with token
            cost or license constraints are reported as such, and vendor
            self-reports are never promoted to independent measurements. Treat
            every figure in this chapter as a {SCIENCE_INDEX.compiled} snapshot —
            the open-model landscape moves on a weekly cadence.
          </p>
        </EvidenceNote>
      </div>

      <div className="rule my-10" />

      {/* Scientific map */}
      <SubHead>Scientific research map</SubHead>
      <figure className="panel-dark overflow-hidden p-2 md:p-4">
        <img
          src="research/scientific_research_map.png"
          alt="Map of the scientific research library: five domain clusters (mathematics, physics, chemistry, biology, and game reconstruction) sized by curated resource occurrences, with the dedicated research agents and their skill packages"
          className="h-auto w-full"
          loading="lazy"
        />
        <figcaption className="px-2 pb-2 pt-2 text-xs text-[hsl(var(--dark-ink-soft))]">
          Compiled {SCIENCE_INDEX.compiled} from the four domain research
          libraries and the game-reconstruction catalog; cluster sizes reflect
          curated resource occurrences, not field importance.
        </figcaption>
      </figure>

      <div className="rule my-10" />

      {/* SOTA landscape */}
      <SubHead>Open-model landscape: openness and selection</SubHead>
      <p className="prose-evidence mb-4 max-w-3xl text-sm text-[hsl(var(--ink-soft))]">
        “Open” is an eight-position spectrum, not a binary — and the
        license–quality relationship inverts by domain. In image and video
        generation the strongest open weights carry non-permissive terms, while
        in OCR and English ASR permissive sub-1.5B specialists top the
        independent boards outright.
      </p>
      <div className="overflow-x-auto border border-[hsl(var(--line))]">
        <table className="table-cat min-w-[640px]">
          <thead>
            <tr className="border-b border-[hsl(var(--line))] text-left">
              <th scope="col" className="px-3 py-2 text-xs font-bold uppercase tracking-wider">Tier</th>
              <th scope="col" className="px-3 py-2 text-xs font-bold uppercase tracking-wider">Meaning</th>
              <th scope="col" className="px-3 py-2 text-xs font-bold uppercase tracking-wider">Examples & notes</th>
            </tr>
          </thead>
          <tbody>
            {OPENNESS_SPECTRUM.map((o) => (
              <tr key={o.tier} className="border-b border-[hsl(var(--line))] align-top last:border-0">
                <td className="mono px-3 py-2 font-bold">{o.tier}</td>
                <td className="px-3 py-2 font-bold">{o.name}</td>
                <td className="prose-evidence px-3 py-2 text-xs">{o.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <ol className="space-y-4">
          {SELECTION_WORKFLOW.map((s) => (
            <li key={s.step}>
              <p className="text-sm font-bold">{s.step}</p>
              <p className="prose-evidence mt-1 text-sm text-[hsl(var(--ink-soft))]">
                {s.body}
              </p>
            </li>
          ))}
        </ol>
        <EvidenceNote title="Models do not run in this app" accent="cornflower">
          <p>
            This atlas is a static evidence bundle: it links to official
            registries and independent evaluators, and it ships the verified
            metadata ([R] records) — it does not download weights, execute
            model code, or proxy inference. Local serving is a separate,
            explicitly gated workflow owned by the Local Model Runtime
            Engineering package.
          </p>
        </EvidenceNote>
      </div>

      <figure className="panel-dark mt-6 overflow-hidden p-2 md:p-4">
        <img
          src="research/sota_model_landscape.png"
          alt="SOTA open-model landscape chart: model families positioned by independently measured capability and openness tier, from full open source (O0) through permissive, conditional, restricted, gated, and hosted-only licenses, with vendor-reported claims visually separated from independent measurements"
          className="h-auto w-full"
          loading="lazy"
        />
        <figcaption className="px-2 pb-2 pt-2 text-xs text-[hsl(var(--dark-ink-soft))]">
          Point-in-time synthesis, {SCIENCE_INDEX.compiled}. Leadership is scoped
          per benchmark and license tier; no position on this chart is a
          universal state of the art.
        </figcaption>
      </figure>

      <div className="rule my-10" />

      {/* AI research frontier */}
      <SubHead>AI research frontier — snapshot {FRONTIER.snapshot}</SubHead>
      <p className="prose-evidence mb-4 max-w-3xl text-sm text-[hsl(var(--ink-soft))]">
        A point-in-time curated corpus (source verification{' '}
        {FRONTIER.verificationDates}) joining three verified collections —
        NLP/LLM agents, data science/ML, and multimodal/scientific AI — with
        the practice document and its role charters. It is not a census of the
        field: absence of a paper is not a judgment, all quoted results are
        paper-reported, and vendor-authored records stay labeled as
        vendor-reported.
      </p>
      <div className="panel-dark p-5">
        <p className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-[hsl(42_78%_55%)]">
          Frontier corpus at a glance · snapshot {FRONTIER.snapshot}
        </p>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat dark value={FRONTIER.papers} label="Deduplicated papers" />
          <Stat dark value={FRONTIER.venues} label="Canonical venues" />
          <Stat dark value={FRONTIER.artifacts} label="Verified code/data artifacts" />
          <Stat dark value={FRONTIER.paperBenchmarkPairs} label="Paper–benchmark pairs" />
          <Stat dark value={FRONTIER.topics} label="Topics" />
          <Stat dark value={FRONTIER.graph.nodes} label="Knowledge-graph nodes" />
          <Stat dark value={FRONTIER.graph.edges} label="Knowledge-graph edges" />
          <Stat dark value={FRONTIER.roles} label="Research roles" />
        </div>
        <p className="prose-evidence mt-4 text-xs text-[hsl(var(--dark-ink-soft))]">
          By field:{' '}
          {FRONTIER.fields.map((f) => `${f.field} ${f.papers}`).join(' · ')}.
          Evidence status: {FRONTIER.evidenceStatus}. {FRONTIER.papersWithArtifact}{' '}
          of {FRONTIER.papers} papers carry at least one verified artifact link;
          empty artifact fields mean “none verified”, not “none exists”.
        </p>
      </div>

      <figure className="panel-dark mt-6 overflow-hidden p-2 md:p-4">
        <img
          src={FRONTIER.networkImage}
          alt="Network map of the AI research-frontier corpus: three field panels (NLP/LLM agents, data science/ML, multimodal/scientific AI) with venue columns, 101 papers drawn as dots on venue spokes colored by evidence class, a labeled side panel for singleton venues, and per-field topic lanes"
          className="h-auto w-full"
          loading="lazy"
        />
        <figcaption className="px-2 pb-2 pt-2 text-xs text-[hsl(var(--dark-ink-soft))]">
          {FRONTIER.networkLayout}; the fixed greedy-modularity audit (
          {FRONTIER.graph.communities} communities, top-6 listed) is retained
          on-canvas and describes this corpus only — no universal ranking is
          implied. The underlying graph encodes {fmt(FRONTIER.graph.nodes)}{' '}
          nodes and {fmt(FRONTIER.graph.edges)} typed edges; it contains no
          citation or coauthor edges because the sources contain none.
        </figcaption>
      </figure>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <ul className="border-t border-[hsl(var(--ink))]">
          {[
            {
              href: FRONTIER.report,
              title: 'Integrated dataset and synthesis report',
              note: 'Corpus distributions, venue landscape, cross-field themes, research gaps, staged reading roadmaps, and snapshot limitations',
              file: 'ai_research_frontier_report.md',
            },
            {
              href: FRONTIER.workbook,
              title: 'Dataset workbook',
              note: 'Summary counts are live formulas with OK/MISMATCH integrity checks; Paper_Occurrences proves 101 = 33 + 30 + 38',
              file: 'ai_research_frontier_dataset.xlsx',
            },
            {
              href: FRONTIER.graphJson,
              title: 'Knowledge graph (JSON)',
              note: 'Typed edges with evidence status and provenance; owned-by-role edges are charter-derived organizational assignments, not bibliographic facts',
              file: 'ai_research_knowledge_graph.json',
            },
            {
              href: FRONTIER.practice,
              title: 'Senior AI research practice',
              note: 'The practice document behind the ai-research-frontier skill — re-verify each cited venue policy page per cycle',
              file: 'senior_ai_research_practice.md',
            },
          ].map((r) => (
            <li key={r.href}>
              <a
                href={r.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[44px] w-full items-baseline justify-between gap-3 border-b border-[hsl(var(--line))] px-3 py-2 text-left transition-colors hover:bg-[hsl(var(--paper-raised))]"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-bold">{r.title}</span>
                  <span className="block text-xs font-normal text-[hsl(var(--ink-soft))]">
                    {r.note}
                  </span>
                </span>
                <span className="mono w-28 shrink-0 break-all text-right text-xs text-[hsl(var(--ink-soft))] sm:w-auto sm:break-normal">
                  {r.file}
                </span>
              </a>
            </li>
          ))}
        </ul>
        <EvidenceNote title="A snapshot, not a census" accent="sage">
          <p>
            Three curated collections carry their own selection biases;
            verification dates are {FRONTIER.verificationDates} and URLs,
            licenses, gating, and leaderboard positions age in weeks. The{' '}
            <a
              className="ext-link"
              href="research/skills/ai-research-frontier/SKILL.md"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>ai-research-frontier skill package</span>
            </a>{' '}
            ships under{' '}
            <span className="mono">research/skills/ai-research-frontier/</span>{' '}
            with its four reference files.
          </p>
        </EvidenceNote>
      </div>

      <div className="rule my-10" />

      {/* Source reports */}
      <SubHead>Source reports — bundled with this app</SubHead>
      <p className="prose-evidence mb-4 max-w-3xl text-sm text-[hsl(var(--ink-soft))]">
        The reviewed reports behind every figure above ship inside the app
        bundle. Links open the plain-text or workbook originals served from this
        site — nothing is fetched from outside the deployment.
      </p>
      <ul className="border-t border-[hsl(var(--ink))]">
        {SOURCE_REPORTS.map((r) => (
          <li key={r.file}>
            <a
              href={r.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[44px] w-full items-baseline justify-between gap-3 border-b border-[hsl(var(--line))] px-3 py-2 text-left transition-colors hover:bg-[hsl(var(--paper-raised))]"
            >
              <span className="min-w-0">
                <span className="block text-sm font-bold">{r.title}</span>
                <span className="block text-xs font-normal text-[hsl(var(--ink-soft))]">
                  {r.role}
                </span>
              </span>
              <span className="mono w-28 shrink-0 break-all text-right text-xs text-[hsl(var(--ink-soft))] sm:w-auto sm:break-normal">
                {r.file}
              </span>
            </a>
          </li>
        ))}
      </ul>

      <div className="rule my-10" />

      {/* Official resources */}
      <SubHead>Official resources</SubHead>
      <p className="prose-evidence mb-4 max-w-3xl text-sm text-[hsl(var(--ink-soft))]">
        External links open the official registries, literature databases, and
        independent evaluators the agents verify against.
      </p>
      <ul className="grid gap-3 md:grid-cols-2">
        {OFFICIAL_RESOURCES.map((r) => (
          <li
            key={r.url}
            className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-3"
          >
            <ExtLink href={r.url} className="text-sm font-bold">
              {r.name}
            </ExtLink>
            <p className="prose-evidence mt-1 text-xs">{r.note}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

import { ExtLink } from '@/components/ExtLink';
import { Expand } from '@/components/Expand';
import { EvidenceNote, SectionHeader, SubHead } from '@/components/SectionHeader';
import { Stat } from '@/components/Stat';
import { REVERSE } from '@/data/reverse';
import { fmt } from '@/lib/format';

const GAME_TYPE_ORDER = [
  'static-recomp',
  'decompilation',
  'engine-remake',
  'source-port',
  'disassembly',
  'browser-port',
  'tool',
];

export default function Reverse() {
  const R = REVERSE;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-8 md:py-12">
      <SectionHeader kicker="Chapter 05 · Reverse engineering" title="Defensive reverse-engineering evidence base">
        Five public sources were normalized into one evidence base of{' '}
        {fmt(R.analysis.sourceOccurrences)} source occurrences resolving to{' '}
        {fmt(R.analysis.uniqueProjects)} in-scope unique projects under
        repository-root grouping — {fmt(R.analysis.multiSourceProjects)} of them
        corroborated by two or more sources. 189 excluded-only Tier-4 projects
        were removed from analytics while every source occurrence is retained.
        This is a snapshot of specific catalogs and samples — explicitly not a
        census of all reverse-engineering work, and star counters are
        popularity signals, not adoption or quality evidence.
      </SectionHeader>

      <div className="panel-dark mb-10 grid grid-cols-2 gap-4 p-5 md:grid-cols-4">
        <Stat dark value={R.analysis.sourceOccurrences} label="Source occurrences" note="across 5 sources" />
        <Stat dark value={R.analysis.uniqueProjects} label="Unique projects" note="repo-root grouping, in scope" />
        <Stat dark value={R.analysis.multiSourceProjects} label="Multi-source projects" note="seen in 2+ sources" />
        <Stat dark value={R.reaCatalog.resourceCount} label="Curated REA resources" note={`reviewed ${R.reaCatalog.latestReview}`} />
      </div>

      {/* REA tool vs showcase */}
      <SubHead>The REA tool and its official showcases</SubHead>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-5">
          <p className="prose-evidence text-sm">
            <strong>REA — Reverse Engineer Anything</strong> is an upstream CLI
            and MCP server for evidence-based investigation of shipped
            software. The catalog around it distinguishes the tool itself from
            showcases: case studies that demonstrate a workflow on a specific
            target. The three official showcases below are documentation of
            method with pinned evidence — not instructions to bypass controls.
          </p>
          <p className="mt-3 text-sm">
            <ExtLink href={R.reaCatalog.repositoryUrl}>REA upstream repository</ExtLink>
            {' · '}
            <ExtLink href={R.reaCatalog.siteUrl}>Curated catalog site</ExtLink>
          </p>
        </div>
        <ul className="space-y-3">
          {R.officialShowcases.map((s) => (
            <li key={s.url} className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <ExtLink href={s.url} className="text-base font-bold">{s.name}</ExtLink>
                <span className="chip chip-sage">Evidence class {s.evidenceClass}</span>
              </div>
              <p className="prose-evidence mt-2 text-sm">{s.description}</p>
              <p className="mt-2 text-xs text-[hsl(var(--ink-soft))]">
                Targets: {s.targets.join(', ')}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <div className="rule my-10" />

      {/* Source tiers */}
      <SubHead>Source tiers — what each count means</SubHead>
      <p className="prose-evidence mb-4 max-w-3xl text-sm text-[hsl(var(--ink-soft))]">
        Each project is assigned the strongest tier it appears in. Tier 1 is
        source-reviewed; Tier 5 is a popularity-biased topic sample. Overlap is
        real: the same project often appears in several sources, so occurrence
        counts must not be summed into a total of unique work.
      </p>
      <div className="overflow-x-auto border border-[hsl(var(--line))]">
        <table className="table-cat min-w-[640px]">
          <thead>
            <tr className="border-b border-[hsl(var(--line))] text-left">
              <th scope="col" className="px-3 py-2 text-xs font-bold uppercase tracking-wider">Tier</th>
              <th scope="col" className="px-3 py-2 text-xs font-bold uppercase tracking-wider">Definition</th>
              <th scope="col" className="px-3 py-2 text-right text-xs font-bold uppercase tracking-wider">Unique projects at best tier</th>
            </tr>
          </thead>
          <tbody>
            {R.analysis.tierCounts.map((t) => (
              <tr key={t.tier} className="border-b border-[hsl(var(--line))] align-top last:border-0">
                <td className="mono px-3 py-2 font-bold">T{t.tier}</td>
                <td className="px-3 py-2">{t.label}</td>
                <td className="mono px-3 py-2 text-right font-bold">{fmt(t.count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 overflow-x-auto border border-[hsl(var(--line))]">
        <table className="table-cat min-w-[640px]">
          <thead>
            <tr className="border-b border-[hsl(var(--line))] text-left">
              <th scope="col" className="px-3 py-2 text-xs font-bold uppercase tracking-wider">Source</th>
              <th scope="col" className="px-3 py-2 text-right text-xs font-bold uppercase tracking-wider">Occurrences</th>
            </tr>
          </thead>
          <tbody>
            {R.analysis.perSourceOccurrences.map((s) => (
              <tr key={s.source} className="border-b border-[hsl(var(--line))] last:border-0">
                <td className="px-3 py-2">{s.source}</td>
                <td className="mono px-3 py-2 text-right font-bold">{fmt(s.count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rule my-10" />

      {/* Clusters */}
      <SubHead>{R.analysis.clusterCount} topic clusters across {fmt(R.analysis.uniqueProjects)} unique projects</SubHead>
      <p className="prose-evidence mb-4 max-w-3xl text-sm text-[hsl(var(--ink-soft))]">
        Clusters come from TF-IDF + NMF over project names and descriptions
        with a fixed seed — an exploratory map of themes, not a taxonomy of
        record. Labels use corrected cluster IDs from the 2026-11-20
        re-clustering of the in-scope population. Representative projects are
        the highest-loading members of each cluster. Audit note: clusters{' '}
        {R.analysis.mixedClusters.map((c) => `C${c}`).join(', ')}{' '}
        are mixed or approximate themes; read them as loose groupings, not clean categories.
      </p>
      <ol className="border-t border-[hsl(var(--ink))]">
        {R.clusters.map((c) => (
          <li key={c.clusterId} className="border-b border-[hsl(var(--line))]">
            <Expand
              header={() => (
                <span className="flex min-w-0 items-baseline gap-3">
                  <span className="mono w-10 shrink-0 text-xs text-[hsl(var(--ink-soft))]">
                    C{c.clusterId}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold">
                      {c.topTerms.split(',').slice(0, 3).join(' · ')}
                      <span className="mono ml-2 font-semibold text-[hsl(var(--ink-soft))]">
                        ({fmt(c.nDocs)})
                      </span>
                      {R.analysis.mixedClusters.includes(c.clusterId) ? (
                        <span className="chip chip-mustard ml-2">mixed / approximate</span>
                      ) : null}
                    </span>
                    <span className="mono mt-1 block text-[11px] text-[hsl(var(--ink-soft))]">
                      {c.topTerms}
                    </span>
                  </span>
                </span>
              )}
            >
              <ul className="space-y-2 text-sm">
                {c.reps.map((r) => (
                  <li key={r.url}>
                    <ExtLink href={r.url}>{r.name}</ExtLink>
                    {r.description ? (
                      <span className="block text-xs text-[hsl(var(--ink-soft))]">{r.description}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Expand>
          </li>
        ))}
      </ol>

      <div className="rule my-10" />

      {/* Reconstruction taxonomy — final workbook counts */}
      <SubHead>
        Game reconstruction taxonomy ({fmt(R.analysis.gamesFinal.totalRecords)} catalog records:{' '}
        {fmt(R.analysis.gamesFinal.games)} games + {R.analysis.gamesFinal.mods} mods)
      </SubHead>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <ol className="border-t border-[hsl(var(--ink))]">
          {GAME_TYPE_ORDER.filter((k) => R.games.topics[k]).map((k) => (
            <li key={k} className="border-b border-[hsl(var(--line))] py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-bold">{R.games.topics[k].name}</span>
                <span className="mono text-sm font-bold">
                  {fmt(R.analysis.gamesFinal.typeCounts[k] ?? 0)}
                </span>
              </div>
              <p className="prose-evidence mt-1 text-sm text-[hsl(var(--ink-soft))]">
                {R.games.topics[k].description}
              </p>
            </li>
          ))}
        </ol>
        <div className="space-y-4">
          <EvidenceNote title="Activity, not health" accent="sage">
            <p>
              Of {fmt(R.analysis.gamesFinal.totalRecords)} game-catalog records:{' '}
              <span className="mono">{fmt(R.analysis.gamesFinal.activity.active)}</span> active
              (commit after {R.analysis.gamesFinal.activityCutoff}),{' '}
              <span className="mono">{fmt(R.analysis.gamesFinal.activity.inactive)}</span> inactive,{' '}
              <span className="mono">{fmt(R.analysis.gamesFinal.activity.unknown)}</span> with
              unknown activity. Activity is a maintenance signal for a snapshot
              date, not a judgment of project quality.
            </p>
            <p className="mt-2">
              Link check: {fmt(R.analysis.gamesFinal.linkStatus['200'] ?? 0)} of{' '}
              {fmt(R.analysis.gamesFinal.totalRecords)} catalog links returned
              HTTP 200 on the check date; exceptions:{' '}
              grand-theft-auto-v (401) and super-mario-64-multiplayer (403).
              Note: {R.analysis.gamesFinal.linkOkDisclosure}.
            </p>
          </EvidenceNote>
          <div className="panel-dark p-4 text-sm">
            <p className="kicker mb-2 !text-[hsl(42_78%_55%)]">
              Catalog sources
            </p>
            <ul className="space-y-1">
              {R.games.sources.map((s) => (
                <li key={s.url}>
                  <ExtLink href={s.url}>{s.name}</ExtLink>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="rule my-10" />

      {/* Interoperability categories */}
      <SubHead>Interoperability catalog — {fmt(R.interoperability.n)} rows across {R.interoperability.categories.length} categories</SubHead>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {R.interoperability.categories.map((c) => (
          <div key={c.slug} className="flex items-baseline justify-between gap-2 border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] px-3 py-2 text-sm">
            <span>{c.name}</span>
            <span className="mono font-bold">{fmt(c.count)}</span>
          </div>
        ))}
      </div>

      <div className="rule my-10" />

      {/* Popularity caution + rights/safety */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="min-w-0">
          <SubHead>Popularity caution — topic snapshot</SubHead>
          <p className="prose-evidence mb-3 text-sm text-[hsl(var(--ink-soft))]">
            Method: “{R.topicSnapshot.method}”. The table lists the
            highest-starred projects in that sample. Star counters measure
            GitHub attention on a retrieval date; they are not adoption,
            quality, or safety evidence.
          </p>
          <div className="overflow-x-auto border border-[hsl(var(--line))]">
            <table className="table-cat min-w-[640px]">
              <thead>
                <tr className="border-b border-[hsl(var(--line))] text-left">
                  <th scope="col" className="px-3 py-2 text-xs font-bold uppercase tracking-wider">Project</th>
                  <th scope="col" className="px-3 py-2 text-right text-xs font-bold uppercase tracking-wider">Stars</th>
                  <th scope="col" className="px-3 py-2 text-xs font-bold uppercase tracking-wider">License</th>
                </tr>
              </thead>
              <tbody>
                {R.topicSnapshot.top.map((t) => (
                  <tr key={t.fullName} className="border-b border-[hsl(var(--line))] last:border-0">
                    <td className="px-3 py-2">
                      <ExtLink href={t.url}>{t.fullName}</ExtLink>
                      {t.archived ? <span className="chip chip-alert ml-2">Archived</span> : null}
                    </td>
                    <td className="mono px-3 py-2 text-right">{fmt(t.stars)}</td>
                    <td className="px-3 py-2">{t.license || 'Unknown / not collected'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="min-w-0">
          <SubHead>Rights & safety guidance</SubHead>
          <EvidenceNote title="Authorized analysis only" accent="mustard">
            <ul className="list-disc space-y-2 pl-5">
              <li>Establish authorization or use a deliberately provided lab/CTF target before inspecting any binary, app, firmware, or protocol.</li>
              <li>Preserve evidence: record artifact identities, hashes, tool versions, and chain of custody.</li>
              <li>Start static; execute only in isolated sandboxes. Do not bypass access controls, DRM, or licensing checks.</li>
              <li>Reconstructions of commercial games typically require the original assets; owning the original does not grant redistribution rights.</li>
              <li>A blank or “NOASSERTION” license marker means unknown or not collected — never proof that a work is unlicensed. Either way it grants no reuse rights: treat public visibility as no license.</li>
              <li>Report confidence and limits with every finding; a plausible decompilation is not proof of original behavior.</li>
            </ul>
          </EvidenceNote>
          <div className="mt-4">
            <EvidenceNote title="Not a census" accent="cornflower">
              The {fmt(R.analysis.uniqueProjects)} unique projects are the
              union of five specific sources with known biases — curated
              selection, automated scans, and star-ranked samples. Absence from
              this base is not evidence a project does not exist.
            </EvidenceNote>
            <div className="mt-4">
              <EvidenceNote title="Field coverage limits" accent="cornflower">
                Language is recorded only by the interoperability catalog and
                the topic snapshot; it is blank (unknown, not “no language”)
                for {fmt(R.analysis.languageBlank)} records — the game and
                REA-catalog sources do not record language at all. Tier-1 rows
                carry no activity dates; their catalog review date is not an
                activity signal. License blanks are unknown or not collected,
                not unlicensed.
              </EvidenceNote>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

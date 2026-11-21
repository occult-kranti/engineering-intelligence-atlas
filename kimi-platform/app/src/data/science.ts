/**
 * Science & Models chapter dataset — distilled at build time from
 * scientific_research_index.json (compiled 2026-11-20), the ten agent
 * charters in scientific-research-library/agents/ (seven library agents plus
 * the AI research-frontier director / scientist / writer-editor trio),
 * sota_open_model_landscape.md, and the AI research-frontier corpus
 * (ai_research_frontier_report.md, snapshot 2026-11-21). Source reports are
 * bundled under /research/ so every link below stays inside the deployed app
 * bundle.
 */

export interface ScienceAgent {
  id: string;
  name: string;
  domain: string;
  skill: string;
  mission: string;
  charter: string;
  charterStatus: 'dedicated' | 'derived';
  accent: 'mustard' | 'sage' | 'cornflower';
}

export interface SourceReport {
  file: string;
  title: string;
  role: string;
  /** Bundle-relative href under /research/. */
  href: string;
}

export const SCIENCE_INDEX = {
  compiled: '2026-11-20',
  verificationDate: '2026-11-20',
  trustPolicy:
    'Evidence labels propagated verbatim; [V] vendor-reported is never independently verified; no universal SOTA ranking exists.',
} as const;

export const SCIENCE_COUNTS = {
  agents: 10,
  skills: 21,
  resourceOccurrences: 4163,
  uniqueResourceUrls: 3813,
  gameCatalogRows: 3030,
  modelEntries: 105,
  evaluationRows: 73,
  resourceEvidenceClasses: {
    reportCurated: 1083,
    gameEcosystemTiers: 50,
    tier2LinkChecked: 3030,
  },
  modelEvidenceClasses: {
    vAndIMixed: 20,
    vVendorOnly: 26,
    iIndependent: 30,
    unlabeled: 23,
    rRegistry: 6,
  },
  domainCoverage: [
    { domain: 'Game Reconstruction', occurrences: 3080 },
    { domain: 'Physics', occurrences: 456 },
    { domain: 'Mathematics', occurrences: 409 },
    { domain: 'Biology', occurrences: 166 },
    { domain: 'Chemistry', occurrences: 52 },
  ],
} as const;

export const SCIENCE_AGENTS: ScienceAgent[] = [
  {
    id: 'mathematics-researcher',
    name: 'Mathematics Researcher',
    domain: 'Mathematics',
    skill: 'mathematics-research',
    mission:
      'Retrieve and correctly attribute mathematical knowledge, perform exact/symbolic/numeric computation, draft and critique proofs, and formalize results in proof assistants — labeling the epistemic status of every statement across the 19-area discipline map.',
    charter: 'research/agents/mathematics-researcher.md',
    charterStatus: 'dedicated',
    accent: 'cornflower',
  },
  {
    id: 'physics-researcher',
    name: 'Physics Researcher',
    domain: 'Physics',
    skill: 'physics-research',
    mission:
      'Evidence-backed, dimensionally consistent physics research and calculation from classical mechanics to QFT, astrophysics, and computational physics — SI units, GUM-style uncertainty budgets, and A/B/C/D/X claim grading against primary data (CODATA, PDG, NNDC, INSPIRE-HEP, NASA ADS).',
    charter: 'research/agents/physics-researcher.md',
    charterStatus: 'dedicated',
    accent: 'mustard',
  },
  {
    id: 'chemistry-researcher',
    name: 'Chemistry Researcher',
    domain: 'Chemistry',
    skill: 'chemistry-research',
    mission:
      'Source-grounded, safety-aware chemical inquiry across the 12-area domain map: IUPAC nomenclature and identifier resolution, versioned database retrieval, and reproducible open-source computational workflows — under non-negotiable wet-lab and weapons-content safety boundaries.',
    charter: 'research/agents/chemistry-researcher.md',
    charterStatus: 'dedicated',
    accent: 'sage',
  },
  {
    id: 'biology-researcher',
    name: 'Biology Researcher',
    domain: 'Biology',
    skill: 'biology-research',
    mission:
      'Dry-lab-first, source-grounded biological inquiry from molecular and cell biology to ecology and neuroscience: literature-grounded answers, computational analysis design, versioned database retrieval, and sober appraisal of AI-in-biology claims.',
    charter: 'research/agents/biology-researcher.md',
    charterStatus: 'dedicated',
    accent: 'sage',
  },
  {
    id: 'science-history-researcher',
    name: 'Science History Researcher',
    domain: 'Science History',
    skill: 'science-history-research',
    mission:
      'Archive-first history of science: priority and attribution verdicts from the primary record, dated source matrices, and myth/fact audits of famous quotations and inventor legends (Newton, Tesla, Fibonacci/Liber Abaci and Indian priority, golden-ratio folklore).',
    charter: 'research/agents/science-historian.md',
    charterStatus: 'dedicated',
    accent: 'mustard',
  },
  {
    id: 'game-reconstruction-engineer',
    name: 'Game Reconstruction Engineer',
    domain: 'Game Reconstruction',
    skill: 'game-reconstruction-engineering',
    mission:
      'Plan and execute authorized, evidence-preserving game reconstruction — matching decompilation, static recompilation, source ports, and engine remakes — with clean-room separation, bring-your-own-assets discipline, reproducible builds, and human-gated release.',
    charter: 'research/agents/game-reconstruction-engineer.md',
    charterStatus: 'dedicated',
    accent: 'cornflower',
  },
  {
    id: 'ai-open-model-researcher',
    name: 'AI Open-Model Researcher',
    domain: 'AI Open-Model Landscape',
    skill: 'ai-open-model-research',
    mission:
      'Maintain an accurate, evidence-labeled, license-literate picture of the open-model landscape so model selection is defensible: openness classification (O0–O7), verified download records, vendor-versus-independent benchmark appraisal, and honest hardware fit — never a universal state of the art.',
    charter: 'research/agents/ai-open-model-researcher.md',
    charterStatus: 'dedicated',
    accent: 'cornflower',
  },
  {
    id: 'ai-research-director',
    name: 'AI Research Director',
    domain: 'AI Research Frontier',
    skill: 'ai-research-frontier',
    mission:
      'Direct a portfolio of AI/NLP research projects from question selection to published, reproducible papers at Tier-A venues (ACL/EMNLP/NAACL/EACL via ARR, NeurIPS, ICML, ICLR, ACM venues): research agenda, venue/cycle targeting, claim-evidence discipline, ethics and provenance gates, and the final go/no-go for every external milestone — without ever letting schedule pressure waive a gate.',
    charter: 'research/agents/ai-research-director.md',
    charterStatus: 'dedicated',
    accent: 'mustard',
  },
  {
    id: 'senior-ai-research-scientist',
    name: 'Senior AI Research Scientist',
    domain: 'AI Research Frontier',
    skill: 'ai-research-frontier',
    mission:
      'Turn a framed research question and claim table into defensible evidence: verified literature grounding, correctly designed experiments, statistically sound comparisons, and a reproducible artifact package that satisfies the NeurIPS/ARR checklist regime and can pass ACM-style artifact evaluation — full provenance, and never adjusting results to fit a claim.',
    charter: 'research/agents/senior-ai-research-scientist.md',
    charterStatus: 'dedicated',
    accent: 'sage',
  },
  {
    id: 'research-writer-reproducibility-editor',
    name: 'Research Writer / Reproducibility Editor',
    domain: 'AI Research Frontier',
    skill: 'ai-research-frontier',
    mission:
      'Turn approved claim tables and evidence packs into papers that survive Tier-A scrutiny: claim-disciplined prose, accurate venue checklists (ARR Responsible NLP, NeurIPS), ARR-rule-compliant author responses, and camera-ready packages that pass ACLPUB formatting, anonymity, rights, and license audits — never upgrading a claim beyond its evidence.',
    charter: 'research/agents/research-writer-reproducibility-editor.md',
    charterStatus: 'dedicated',
    accent: 'cornflower',
  },
];

export const SOURCE_REPORTS: SourceReport[] = [
  {
    file: 'mathematics_research_library.md',
    title: 'Mathematics research library',
    role: '409 curated resource occurrences across the 19-area discipline map',
    href: 'research/mathematics_research_library.md',
  },
  {
    file: 'physics_research_library.md',
    title: 'Physics research library',
    role: '456 curated resource occurrences across classical-to-computational physics',
    href: 'research/physics_research_library.md',
  },
  {
    file: 'chemistry_research_library.md',
    title: 'Chemistry research library',
    role: '52 curated resource occurrences across the 12-area domain map',
    href: 'research/chemistry_research_library.md',
  },
  {
    file: 'biology_research_library.md',
    title: 'Biology research library',
    role: '166 curated resource occurrences, dry-lab-first',
    href: 'research/biology_research_library.md',
  },
  {
    file: 'game_reconstruction_and_forks.md',
    title: 'Game reconstruction & forks catalog',
    role: '3,030 link-checked catalog rows across six reconstruction classes and tools/mods',
    href: 'research/game_reconstruction_and_forks.md',
  },
  {
    file: 'sota_open_model_landscape.md',
    title: 'SOTA open-model landscape — synthesis report',
    role: 'Point-in-time synthesis (2026-11-20) of four domain surveys plus the verified registry snapshot',
    href: 'research/sota_open_model_landscape.md',
  },
  {
    file: 'sota_language_coding_models.md',
    title: 'SOTA language & coding models',
    role: 'Domain survey: frontier MoE, coding agents, serving footprints',
    href: 'research/sota_language_coding_models.md',
  },
  {
    file: 'sota_multimodal_media_models.md',
    title: 'SOTA multimodal & media models',
    role: 'Domain survey: image, video, ASR, TTS, OCR, GUI agents',
    href: 'research/sota_multimodal_media_models.md',
  },
  {
    file: 'sota_scientific_models.md',
    title: 'SOTA scientific models',
    role: 'Domain survey: math, physics, weather, materials, chemistry, proteins, genomics',
    href: 'research/sota_scientific_models.md',
  },
  {
    file: 'sota_3d_embodied_security_models.md',
    title: 'SOTA 3D, embodied & security models',
    role: 'Domain survey: 3D generation, robotics, security, edge inference',
    href: 'research/sota_3d_embodied_security_models.md',
  },
  {
    file: 'scientific_and_model_research_library.xlsx',
    title: 'Workbook: scientific & model research library',
    role: 'Ten sheets (Guide, Summary, Agent/Skill catalogs, Domain Coverage, Resource Catalog, SOTA Model Catalog, Evaluation Matrix, Data Dictionary); Summary counts are live formulas',
    href: 'research/scientific_and_model_research_library.xlsx',
  },
  {
    file: 'scientific_research_index.json',
    title: 'Machine-readable index',
    role: 'Agents, skills, counts, evidence classes, and sheet inventory as JSON',
    href: 'research/scientific_research_index.json',
  },
  {
    file: 'ai_research_frontier_report.md',
    title: 'AI research-frontier integrated report',
    role: 'Snapshot 2026-11-21: 101 deduplicated papers, 22 venues, 121 verified artifacts across NLP/agents, data science/ML, and multimodal/scientific AI',
    href: 'research/ai_research_frontier_report.md',
  },
  {
    file: 'ai_research_frontier_dataset.xlsx',
    title: 'Workbook: AI research-frontier dataset',
    role: 'Summary counts are live formulas with OK/MISMATCH integrity checks; Paper_Occurrences proves 101 = 33 + 30 + 38',
    href: 'research/ai_research_frontier_dataset.xlsx',
  },
  {
    file: 'ai_research_knowledge_graph.json',
    title: 'Knowledge graph (JSON)',
    role: '1,027 nodes (101 papers, 168 topics, 355 methods, 256 benchmarks, 22 venues, 121 resources, 4 roles) and 1,437 typed edges with provenance',
    href: 'research/ai_research_knowledge_graph.json',
  },
  {
    file: 'senior_ai_research_practice.md',
    title: 'Senior AI research practice',
    role: 'Practice document behind the ai-research-frontier skill: ARR/venue policy, statistics, reproducibility, and writing discipline — re-verify each policy page per cycle',
    href: 'research/senior_ai_research_practice.md',
  },
];

/**
 * AI research-frontier corpus — figures verbatim from
 * ai_research_frontier_report.md (snapshot 2026-11-21; source verification
 * 2026-11-20/21). Point-in-time curated corpus, not a census of the field.
 */
export const FRONTIER = {
  snapshot: '2026-11-21',
  verificationDates: '2026-11-20 / 2026-11-21',
  papers: 101,
  venues: 22,
  topics: 168,
  artifacts: 121,
  paperBenchmarkPairs: 263,
  roles: 4,
  fields: [
    { field: 'NLP / LLM agents', papers: 33 },
    { field: 'Data science / ML', papers: 30 },
    { field: 'Multimodal / scientific AI', papers: 38 },
  ],
  evidenceStatus:
    'peer-reviewed 80 · preprint 2 · preprint/technical report 13 · mixed preprint+peer-reviewed 5 · mixed (partly peer-reviewed components) 1 — no record is ARR-under-review',
  papersWithArtifact: 78,
  graph: { nodes: 1027, edges: 1437, communities: 14 },
  networkLayout:
    'Deterministic small-multiple hub-and-spoke (no force layout): three field panels with venue columns, papers as dots on venue spokes colored by evidence class, and a labeled side panel for 11 singleton venues',
  networkImage: 'research/ai_research_network.png',
  report: 'research/ai_research_frontier_report.md',
  workbook: 'research/ai_research_frontier_dataset.xlsx',
  graphJson: 'research/ai_research_knowledge_graph.json',
  practice: 'research/senior_ai_research_practice.md',
} as const;

/** [V]/[I]/[R] semantics, verbatim from sota_open_model_landscape.md. */
export const EVIDENCE_TIERS = [
  {
    label: '[V]',
    name: 'Vendor-reported',
    body: 'Model card, lab blog, or self-run benchmark — never independently reproduced. 26 of 105 catalog entries are vendor-only; 20 more mix [V] with [I]. Treated as a claim about the vendor, not about the model, until corroborated.',
  },
  {
    label: '[I]',
    name: 'Independently measured',
    body: 'Artificial Analysis, LMArena/Arena, Vals, LiveBench, HF Open ASR Leaderboard, OmniDocBench, GameWorld Score, Matbench Discovery, academic audits. 30 catalog entries carry independent measurement.',
  },
  {
    label: '[R]',
    name: 'Registry-verified metadata',
    body: 'Exact repo ID, pinned commit SHA, byte sizes, LFS sha256 — verified live against the Hugging Face API on 2026-11-20. No weights downloaded, no code executed. 6 entries.',
  },
] as const;

/** O0–O7 openness spectrum from the SOTA synthesis report. */
export const OPENNESS_SPECTRUM = [
  { tier: 'O0', name: 'Full open source', note: 'Weights + training code + training data open under permissive terms (SmolLM3-3B, OLMo 3 7B, Molmo2, OpenCUA). Rare, and concentrated in small language models and scientific computing.' },
  { tier: 'O1', name: 'Open weights + open code, permissive', note: 'Apache-2.0/MIT-class with data or recipe undisclosed — the operative frontier for most builders (Qwen3.x, DeepSeek V4.x, gpt-oss, GLM-5.3-Flash, Mistral Small 4).' },
  { tier: 'O2', name: 'Open weights, custom conditional license', note: 'Permissive-style but with revenue/MAU/MaaS triggers or security-review clauses (Kimi K3.1 Pro: extra terms above $20M revenue / 100M MAU; GLM-5.3 MaaS security review).' },
  { tier: 'O3', name: 'Revenue-capped / territory-restricted community', note: 'Free below a revenue threshold or excluded jurisdictions (FLUX 3 Image Klein free <$5M; LTX-2.5 paid ≥$10M; MiniMax H3 / H3-Image exclude US/EU/UK/KR).' },
  { tier: 'O4', name: 'Non-commercial / research-only', note: 'No commercial use of weights (MiniMax M3 non-commercial by default; Qwen-Image-2.1 research license; FLUX.2 [dev]).' },
  { tier: 'O5', name: 'Gated', note: 'Download requires application, license acceptance, or consent flow (AlphaFold 3 weights, Meta UMA, AlphaGenome, SAM 3D).' },
  { tier: 'O6', name: 'Hosted-only (no weights)', note: 'API/service access only (Wan 2.5/2.6/2.7, FLUX 3, Qwen3.8-Max, Chai-2, Kosmos, AlphaEvolve).' },
  { tier: 'O7', name: 'Quarantined (project policy)', note: 'Verified-uninstallable or unverifiable artifacts that must not ship: HF 404 repos, community quants without pinned provenance, remote-code requirements.' },
];

/** Model-selection workflow from the ai-open-model-research skill. */
export const SELECTION_WORKFLOW = [
  {
    step: '1 · Scope the task and constraints',
    body: 'Name the task class, license budget, hardware budget, and the decision the model feeds. License before benchmarks: a model that cannot legally be used for the intended purpose is excluded regardless of scores.',
  },
  {
    step: '2 · Classify openness (O0–O7)',
    body: 'Never conflate "open weights" with "open source"; record code, weights, and data openness separately per artifact — sibling artifacts in one family routinely carry different licenses.',
  },
  {
    step: '3 · Appraise the evidence',
    body: 'Weight [I] independent evaluations above [V] vendor tables; flag harness sensitivity, benchmark saturation, and single-source scores. There is no universal SOTA — leadership is scoped to a benchmark, a date, a harness, a license tier, and a hardware budget.',
  },
  {
    step: '4 · Verify the artifact ([R])',
    body: 'Pin the exact repo ID and default-revision commit SHA, record per-file byte sizes and LFS hashes, corroborate the license against LICENSE/NOTICE files, and compute the hard memory floor from weight bytes only.',
  },
  {
    step: '5 · Fit to hardware, then re-verify',
    body: 'Express fit as verified floors plus clearly labeled planning estimates — desktop, workstation, or datacenter. Landscape evidence ages in weeks; stamp every deliverable with its as-of date and re-verify when licenses, revisions, gating, or leaderboard positions change materially.',
  },
];

/** Official external resources — links out; nothing runs locally in this app. */
export const OFFICIAL_RESOURCES = [
  { name: 'Hugging Face Hub', url: 'https://huggingface.co/models', note: 'Model registry; repo IDs, revisions, and LFS hashes verified against its API' },
  { name: 'Artificial Analysis', url: 'https://artificialanalysis.ai/', note: 'Independent Intelligence Index and open-weights boards [I]' },
  { name: 'LMArena', url: 'https://lmarena.ai/', note: 'Independent community arena rankings [I]' },
  { name: 'LiveBench', url: 'https://livebench.ai/', note: 'Contamination-resistant independent benchmark [I]' },
  { name: 'arXiv', url: 'https://arxiv.org/', note: 'Primary preprints for physics, mathematics, and model papers' },
  { name: 'INSPIRE-HEP', url: 'https://inspirehep.net/', note: 'High-energy physics literature database' },
  { name: 'NASA ADS', url: 'https://ui.adsabs.harvard.edu/', note: 'Astrophysics and physics literature' },
  { name: 'NIST CODATA', url: 'https://physics.nist.gov/cuu/Constants/', note: 'Authoritative physical constants' },
  { name: 'Particle Data Group', url: 'https://pdg.lbl.gov/', note: 'Particle physics reviewed data' },
  { name: 'PubChem', url: 'https://pubchem.ncbi.nlm.nih.gov/', note: 'Chemical compound records with identifiers' },
];

import type { SkillPackage } from './types';

/**
 * The sixteen agent skill packages developed alongside this atlas: the
 * original eight engineering packages plus the seven science/model-library
 * packages plus graph-memory research (game reconstruction, mathematics, physics, chemistry, biology,
 * science history, AI open-model research). Descriptions are distilled from
 * each package's SKILL.md.
 */
export const SKILL_PACKAGES: SkillPackage[] = [
  {
    id: 'graph-memory-research',
    name: 'Graph Memory Research',
    shortName: 'Graph Memory',
    accent: 'sage',
    tagline: 'Source-linked knowledge, bounded retrieval and correct cache reuse',
    description: 'Builds typed concept and formula graphs, records provenance and time, retrieves evidence with explicit scope, audits cache invalidation, and exports linked portable notes. Connects mathematical foundations to carefully qualified current research.',
    domains: ['Knowledge graphs', 'Memory and caching', 'Evidence research'],
    outputs: ['Typed graph and formula notebook', 'Scoped retrieval and invalidation evidence', 'portable note backup and portable graph exports'],
    gates: ['Authority is checked before retrieval', 'Scores and graph connections are not proof', 'Provider cache telemetry is separate from local cache hits'],
  },

  {
    id: 'engineering-organization-architect',
    name: 'Engineering Organization Architect',
    shortName: 'Org Architect',
    accent: 'mustard',
    tagline: 'Design and audit complete engineering organizations',
    description:
      'Designs and audits engineering, AI/data, cybersecurity, product-design, research, quality, platform/SRE, and game-development organizations. Builds role taxonomies, skill matrices, seniority ladders, team topologies, interfaces, hiring scorecards, and staffing roadmaps around value streams and demonstrated capability rather than fashionable titles.',
    domains: ['Organization design', 'Role architecture', 'Capability planning'],
    outputs: [
      'Role taxonomy and mission statements',
      'Team topology and interface map',
      'Seniority ladder and hiring scorecards',
    ],
    gates: [
      'Frame stage, value streams, and constraints before designing',
      'Does not claim knowledge of confidential company org charts',
    ],
  },
  {
    id: 'engineering-job-market-intelligence',
    name: 'Engineering Job Market Intelligence',
    shortName: 'Job Market Intel',
    accent: 'cornflower',
    tagline: 'Reproducible evidence snapshots of public hiring data',
    description:
      'Collects, normalizes, audits, and analyzes public engineering and product-careers postings across AI/ML, security, frontend/backend, design, research, game, data, platform, and program roles. Produces snapshots with explicit provenance, crawl logs, and stated limitations instead of timeless market claims.',
    domains: ['Hiring evidence', 'Skill frequency', 'Role families'],
    outputs: [
      'Verified job-record snapshots',
      'Title-family and skill-mention aggregates',
      'Source coverage and restriction log',
    ],
    gates: [
      'Source gate: robots.txt and site terms checked before collection',
      'Stops on 401/403, disallow rules, or collection prohibitions',
      'No stealth fingerprints, proxies, or CAPTCHA solving',
    ],
  },
  {
    id: 'defensive-reverse-engineering',
    name: 'Defensive Reverse Engineering',
    shortName: 'Defensive RE',
    accent: 'sage',
    tagline: 'Authorized, evidence-preserving binary analysis',
    description:
      'Performs authorized, evidence-preserving defensive reverse engineering of binaries, firmware, mobile apps, protocols, and malware for interoperability, vulnerability research, incident response, detection engineering, and CTF/lab learning, with chain-of-custody records and sandboxed workflows.',
    domains: ['Binary analysis', 'Interoperability', 'Malware triage'],
    outputs: [
      'Analysis plans and tool selection rationale',
      'IOC and capability reports with confidence',
      'Chain-of-custody and evidence records',
    ],
    gates: [
      'Hard authorization gate before any target inspection',
      'No unauthorized access, piracy, or protection bypass',
      'Static-first; execution only in isolated sandboxes',
    ],
  },
  {
    id: 'spatial-3d-production-engineering',
    name: 'Spatial 3D Production Engineering',
    shortName: 'Spatial 3D',
    accent: 'cornflower',
    tagline: 'From 3D content to gated physical production',
    description:
      'Designs and audits 3D-content, Blender, spatial UI/UX, real-time/XR, animation, CAD, slicing, firmware, and additive-manufacturing workflows. Separates visual communication, interactive experience, and physical engineering release, using the least powerful workflow that answers the question.',
    domains: ['3D content', 'Additive manufacturing', 'Spatial UX'],
    outputs: [
      'Mesh/glTF/USD validation reports',
      'DfAM and process plans',
      'Accessibility fallbacks for spatial UI',
    ],
    gates: [
      'Visual assets are never manufacturing certification',
      'Human-gated handoff before physical production',
    ],
  },
  {
    id: 'computational-geometry-engineering',
    name: 'Computational Geometry Engineering',
    shortName: 'Geometry',
    accent: 'mustard',
    tagline: 'Rigorous mathematics for meshes, CAD, and spatial systems',
    description:
      'Applies rigorous mathematics and computational geometry to meshes, CAD, graphics, architecture, BIM, 3D printing, robotics, and spatial systems. Covers algorithm selection, geometric proofs, topology and manifold analysis, robust predicates, tolerances, units, and numerical stability.',
    domains: ['Mesh & CAD', 'Numerical robustness', 'Geometric optimization'],
    outputs: [
      'Mathematical contracts for geometry tasks',
      'Mesh audit and topology reports',
      'Reproducible geometry-engineering evidence',
    ],
    gates: [
      'Units, topology, and tolerances recorded before optimizing',
      'Never infers real-world units from file size or proportions',
    ],
  },
  {
    id: 'architecture-and-built-heritage-research',
    name: 'Architecture & Built Heritage Research',
    shortName: 'Built Heritage',
    accent: 'sage',
    tagline: 'Tradition-specific architectural research with provenance',
    description:
      'Researches architecture across modern/contemporary, classical Greek/Roman, ancient Indian, Egyptian, historical Chinese, and other traditions with computational-design, BIM, geometry, conservation, and provenance discipline. Grounds analysis in specific places, periods, communities, and sources.',
    domains: ['Architectural research', 'Heritage documentation', 'openBIM workflows'],
    outputs: [
      'Tradition-specific design analysis',
      'Heritage documentation and provenance records',
      'Parametric and openBIM workflow plans',
    ],
    gates: [
      'Avoids pseudohistory and homogenized "ancient" styles',
      'Conceptual output is not licensed professional approval',
    ],
  },
  {
    id: 'agent-research-director',
    name: 'Agent Research Director',
    shortName: 'Director',
    accent: 'mustard',
    tagline: 'Coordinate bounded, auditable multi-agent research',
    description:
      'Acts as team leader for multi-agent research and engineering: decomposes goals, routes progressive-disclosure skills, dispatches bounded specialists, enforces delegation contracts and evidence gates, resolves conflicts, controls cost and termination, and audits skill provenance, security, and licenses.',
    domains: ['Multi-agent coordination', 'Evidence gates', 'Skill supply chain'],
    outputs: [
      'Delegation contracts and task ledgers',
      'Evidence-gated research deliverables',
      'Skill provenance and security audits',
    ],
    gates: [
      'Human approval before external writes, spending, or physical action',
      'More agents are a hypothesis to evaluate, not a default',
      'Refuses scope expansion that bypasses source policy',
    ],
  },
  {
    id: 'local-model-runtime-engineering',
    name: 'Local Model Runtime Engineering',
    shortName: 'Local Models',
    accent: 'cornflower',
    tagline: 'Verified open-weight models on your own hardware',
    description:
      'Engineers local open-weight model setups on a user’s machine: hardware/storage/GPU/VRAM measurement, task-matched model selection across reviewed model families, pinned and hash-verified downloads, localhost-bounded serving through llama.cpp, Ollama, LM Studio, ComfyUI and similar runtimes, and health gates before connecting local inference to a director/agent node.',
    domains: ['Hardware & VRAM checks', 'Local model runtimes', 'Download verification'],
    outputs: [
      'Hardware capability and fit reports',
      'Pinned, hash-verified model install plans',
      'Localhost serving and provider health gates',
    ],
    gates: [
      'No downloads, installs, or network services without explicit user gates',
      'No trust_remote_code or repo code execution; license and provenance verified per model',
    ],
  },
  {
    id: 'mathematics-research',
    name: 'Mathematics Research',
    shortName: 'Mathematics',
    accent: 'cornflower',
    tagline: 'Source-grounded mathematics with epistemic labels',
    description:
      'Conducts source-grounded mathematics research, exact/symbolic/numeric computation, proof drafting, and formal verification across the 19-area discipline map. Labels every statement by epistemic status — theorem with proof, conjecture, heuristic, folklore, or error-prone popular claim — and refuses to present folklore, near-miss floating-point evidence, or unverified AI proofs as established results.',
    domains: ['Proof & formalization', 'Exact computation', 'Epistemic labeling'],
    outputs: [
      'Verified computations with counterexample-search logs',
      'Kernel-checked formal artifacts (Lean 4/Mathlib et al.)',
      'Source-grounded research reviews with primary citations',
    ],
    gates: [
      'A claim is "known" only when checked against a primary source, exact arithmetic, or a proof assistant',
      'Floating-point agreement is never equality; counterexample search over confirming demos',
    ],
  },
  {
    id: 'physics-research',
    name: 'Physics Research',
    shortName: 'Physics',
    accent: 'mustard',
    tagline: 'Dimensionally consistent, uncertainty-quantified physics',
    description:
      'Conducts evidence-backed physics research, calculation, and literature review from classical mechanics through quantum field theory, condensed matter, plasma, astrophysics, and computational/experimental physics. Enforces dimensional analysis, limiting-case and conservation checks, GUM-style uncertainty budgets, and A/B/C/D/X claim grading against primary data (arXiv, INSPIRE-HEP, NASA ADS, NIST CODATA, PDG, NNDC).',
    domains: ['Physical sciences', 'Uncertainty budgets', 'Primary literature'],
    outputs: [
      'Research memos with confidence grades and inline primary citations',
      'Derivations passing dimensional and limiting-case checks',
      'Verified computational studies with stated environments',
    ],
    gates: [
      'No decision-critical value without SI units and an uncertainty budget',
      'No hazardous-system construction instructions; licensed professionals sign off regulated work',
    ],
  },
  {
    id: 'chemistry-research',
    name: 'Chemistry Research',
    shortName: 'Chemistry',
    accent: 'sage',
    tagline: 'Provenance-traced chemistry with hard safety boundaries',
    description:
      'Conducts source-grounded, safety-aware chemistry research across the 12-area domain map from organic and physical chemistry to materials and medicinal chemistry. Resolves IUPAC nomenclature and identifiers (InChI, SMILES, CAS RN), retrieves database values with version and access date, and designs reproducible open-source computational workflows — under non-negotiable safety boundaries.',
    domains: ['Chemical sciences', 'Identifier resolution', 'Computational workflows'],
    outputs: [
      'Provenance-footered answers with units and uncertainty',
      'Database retrievals with version and access-date records',
      'Reproducible computational chemistry workflow designs',
    ],
    gates: [
      'No operational wet-lab protocols; no synthesis guidance for explosives, chemical-warfare agents, toxins, or controlled substances',
      'Never replaces laboratory judgment, institutional safety review, or EHS professionals',
    ],
  },
  {
    id: 'biology-research',
    name: 'Biology Research',
    shortName: 'Biology',
    accent: 'sage',
    tagline: 'Dry-lab-first biology, source-grounded and version-aware',
    description:
      'Conducts source-grounded, dry-lab-first biology research from molecular and cell biology through genomics, ecology, neuroscience, and reproducible research practice. Designs computational analyses (sequence analysis, omics pipelines, phylogenetics, statistics), records database versions and access dates, and appraises AI-in-biology claims with honest uncertainty.',
    domains: ['Life sciences', 'Computational analysis design', 'Evidence appraisal'],
    outputs: [
      'Literature-grounded answers with provenance records',
      'Computational analysis and pipeline designs',
      'Evidence appraisals of AI-in-biology claims',
    ],
    gates: [
      'No pathogen enhancement, no screening evasion, no clinical interpretation, no hazardous wet-lab protocols',
      'Never replaces laboratory judgment, institutional oversight, or clinical expertise',
    ],
  },
  {
    id: 'science-history-research',
    name: 'Science History Research',
    shortName: 'Science History',
    accent: 'mustard',
    tagline: 'Archive-first history of science, myths audited',
    description:
      'Researches and audits the history of science and invention with primary-source discipline: priority and attribution questions, manuscripts, patents, editions, and archival provenance. Verifies or debunks famous quotations and inventor/discoverer myths (Newton, Tesla, Fibonacci/Liber Abaci and Indian priority, golden-ratio folklore) with dated evidence matrices that separate the primary record from later legend.',
    domains: ['History of science', 'Archival provenance', 'Myth auditing'],
    outputs: [
      'Verdicts with A/B/C/D/X confidence labels and cited primary identifiers',
      'Dated source matrices from private note to commercialization',
      'Pseudohistory and quotation-provenance takedowns with replacement evidence',
    ],
    gates: [
      'Archive before narrative: the earliest dated primary record controls',
      'No load-bearing claim sourced only to quotation sites or unattributed pages; fail-stop (D/X) without a primary source',
    ],
  },
  {
    id: 'game-reconstruction-engineering',
    name: 'Game Reconstruction Engineering',
    shortName: 'Game Reconstruction',
    accent: 'cornflower',
    tagline: 'Authorized, evidence-preserving game reconstruction',
    description:
      'Plans and executes authorized game reverse engineering and reconstruction — matching decompilation, disassembly, static recompilation, source ports, and engine remakes — with clean-room separation where required, bring-your-own-assets discipline, hash-pinned custody records, reproducible builds, and human-gated release. A decompilation is a hypothesis about behavior until verified.',
    domains: ['Game reconstruction', 'Reproducible builds', 'Provenance analysis'],
    outputs: [
      'Authorization records and per-project rights ledgers',
      'Matching/parity evidence against a user-supplied original',
      'Reproducible-build and repository-identity evidence',
    ],
    gates: [
      'Written authorization record (HUMAN-1) before inspecting any target binary, ROM, or asset',
      'Never strips DRM/anti-cheat, bypasses online-service protections, or redistributes copyrighted game assets',
    ],
  },
  {
    id: 'ai-open-model-research',
    name: 'AI Open-Model Research',
    shortName: 'Open Models',
    accent: 'cornflower',
    tagline: 'Evidence-labeled open-model landscape intelligence',
    description:
      'Researches the open-weight and open-source AI model landscape with evidence labels, license literacy, and hardware honesty across language/coding, multimodal and media, scientific domains, and 3D/embodied/security/edge. Classifies openness on the O0–O7 spectrum, produces verified download records (pinned revision, exact bytes, LFS hashes), and separates vendor-reported from independently measured benchmarks. Never declares a universal state of the art.',
    domains: ['Open-model landscape', 'License classification', 'Hardware fit'],
    outputs: [
      'Landscape surveys with inline [V]/[I]/[R] evidence labels and as-of dates',
      'Openness classifications and verified download records',
      'Evaluation matrices and hardware/runtime fit notes',
    ],
    gates: [
      'No universal SOTA: every leadership claim is scoped to benchmark, date, harness, license tier, and hardware budget',
      'License before benchmarks: an unusable license excludes a model regardless of scores',
    ],
  },
];

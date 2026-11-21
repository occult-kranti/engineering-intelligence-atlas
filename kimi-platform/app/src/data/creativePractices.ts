/**
 * Creative practices (2026-11-21): the two creative skill packages and five
 * agent charters, with their source artifacts bundled under /research/.
 * The charters are AGENT CONTEXTS (delegation configurations) mapped onto the
 * EXISTING 109-role catalog — they are not new standing roles, they add no
 * depth-score credit, they close no capability gaps, and they add no
 * evaluation tasks (the packages carry lab acceptance tests, not a scored
 * ET battery). No role inflation: the single Product Designer / UX
 * Researcher candidate remains the only proposed role.
 */

export interface CreativePackage {
  id: string;
  name: string;
  contexts: string[];
  standingRoles: string;
  skillHref: string;
}

export interface CreativeCharter {
  file: string;
  agent: string;
  context: string;
  href: string;
}

export interface CreativeDownload {
  file: string;
  title: string;
  role: string;
  href: string;
}

export const CREATIVE_PACKAGES: CreativePackage[] = [
  {
    id: 'civilization-art-design-research',
    name: 'Civilization Art & Design Research',
    contexts: [
      'civilization-art-research-director',
      'geometric-pattern-symmetry-specialist',
    ],
    standingRoles:
      'architectural-historian-researcher, computational-geometer-applied-mathematician (internal/conditional: architect, conservation, agent-research-director, architectural-geometry, computational-designer, geometry-processing, cad-computational-design)',
    skillHref: 'research/skills/civilization-art-design-research/SKILL.md',
  },
  {
    id: 'music-theory-production-engineering',
    name: 'Music Theory & Production Engineering',
    contexts: [
      'music-theory-research-director',
      'audio-dsp-production-engineer',
      'creative-rights-reproducibility-editor',
    ],
    standingRoles:
      'game-audio-designer-programmer, legal-policy-compliance-specialist primary; research-scientist primary support (internal/conditional: research-engineer, technical-artist, technical-writer, game-creative-director, knowledge-transfer, brand-communications)',
    skillHref: 'research/skills/music-theory-production-engineering/SKILL.md',
  },
];

export const CREATIVE_CHARTERS: CreativeCharter[] = [
  {
    file: 'civilization-art-research-director.md',
    agent: 'Civilization Art Research Director',
    context: 'civilization-art-design-research',
    href: 'research/agents/civilization-art-research-director.md',
  },
  {
    file: 'geometric-pattern-symmetry-specialist.md',
    agent: 'Geometric Pattern & Symmetry Specialist',
    context: 'civilization-art-design-research',
    href: 'research/agents/geometric-pattern-symmetry-specialist.md',
  },
  {
    file: 'music-theory-research-director.md',
    agent: 'Music Theory Research Director',
    context: 'music-theory-production-engineering',
    href: 'research/agents/music-theory-research-director.md',
  },
  {
    file: 'audio-dsp-production-engineer.md',
    agent: 'Audio DSP & Production Engineer',
    context: 'music-theory-production-engineering',
    href: 'research/agents/audio-dsp-production-engineer.md',
  },
  {
    file: 'creative-rights-reproducibility-editor.md',
    agent: 'Creative Rights & Reproducibility Editor',
    context: 'music-theory-production-engineering',
    href: 'research/agents/creative-rights-reproducibility-editor.md',
  },
];

export const CREATIVE_DOWNLOADS: CreativeDownload[] = [
  {
    file: 'civilization_design_music_research.md',
    title: 'Civilization design + music research report',
    role: 'Source panel report: anchored traditions, standing rules, output contracts, verification register',
    href: 'research/civilization_design_music_research.md',
  },
  {
    file: 'civilization_design_repo_cases.json',
    title: 'Civilization repo casebook',
    role: '8 pinned repository cases (museum open data, tiling/pattern tooling; license, sha, lifecycle)',
    href: 'research/civilization_design_repo_cases.json',
  },
  {
    file: 'music_theory_audio_repo_cases.json',
    title: 'Music/audio repo casebook',
    role: '13 pinned repository cases (frameworks, notation, MIR; license, sha, lifecycle)',
    href: 'research/music_theory_audio_repo_cases.json',
  },
  {
    file: 'creative_role_resources.json',
    title: 'Creative role-to-resource mapping',
    role: 'Five agent contexts, tiered resources, role-slug mapping, no-new-standing-roles confirmation',
    href: 'research/creative_role_resources.json',
  },
  {
    file: 'modern_labs.md (civilization)',
    title: 'Civilization modern labs L1–L7',
    role: 'Honestly labeled generative SVG/CAD exercises with fixtures and pass criteria',
    href: 'research/skills/civilization-art-design-research/references/modern_labs.md',
  },
  {
    file: 'modern_labs.md (music/audio)',
    title: 'Music/audio modern labs M1–M7',
    role: 'Measurable acceptance tests; deterministic scripts and generated fixtures make M1/M3/M6 checkable offline',
    href: 'research/skills/music-theory-production-engineering/references/modern_labs.md',
  },
  {
    file: 'assets/ (civilization samples)',
    title: 'Civilization sample assets & fixtures',
    role: 'Prebuilt frieze/grid SVG exercises and symmetry known-answer vectors (modern teaching artifacts)',
    href: 'research/skills/civilization-art-design-research/assets/fixtures/symmetry_known_vectors.json',
  },
  {
    file: 'fixtures/ (music samples)',
    title: 'Music/audio generated fixtures',
    role: 'Original MusicXML/MIDI/WAV fixtures with byte-level provenance (regenerable, license-clean)',
    href: 'research/skills/music-theory-production-engineering/fixtures/provenance.json',
  },
  {
    file: 'creative_resource_fill.json',
    title: 'Creative fill (matrix provenance)',
    role: '19 catalog resources, 73 role edges (RL-1684+), depth-invariance and dedup audit trail',
    href: 'research/creative_resource_fill.json',
  },
];

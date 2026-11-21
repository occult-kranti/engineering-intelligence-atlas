/**
 * Specialist practices (2026-11-21): the two specialist skill packages and
 * six agent charters, with their source artifacts bundled under /research/.
 * The charters are AGENT CONTEXTS (delegation configurations) mapped onto the
 * EXISTING 109-role catalog — they are not new standing roles, they add no
 * depth-score credit, and they close no capability gaps. The single
 * Product Designer / UX Researcher candidate keeps its fuller inventory and
 * ET-CAND evaluations on the candidate draft only.
 */

export interface SpecialistPackage {
  id: string;
  name: string;
  contexts: string[];
  standingRoles: string;
  skillHref: string;
}

export interface SpecialistCharter {
  file: string;
  agent: string;
  context: string;
  href: string;
}

export interface SpecialistDownload {
  file: string;
  title: string;
  role: string;
  href: string;
}

export const SPECIALIST_PACKAGES: SpecialistPackage[] = [
  {
    id: 'architecture-database-backend-engineering',
    name: 'Architecture, Database & Backend Engineering',
    contexts: [
      'software-architecture-principal',
      'database-systems-engineer',
      'backend-platform-staff-engineer',
    ],
    standingRoles:
      'software-solutions-architect, database-engineer-dba, backend-engineer (internal secondaries: staff-principal, security-architect, platform, SRE, api, performance, data)',
    skillHref: 'research/skills/architecture-database-backend-engineering/SKILL.md',
  },
  {
    id: 'ui-ux-research-design-engineering',
    name: 'UI/UX Research, Design & Engineering',
    contexts: [
      'product-ux-research-lead',
      'design-systems-accessibility-engineer',
      'interaction-prototyping-evaluation-specialist',
    ],
    standingRoles:
      'product-psychology-behavioral-design-lead, frontend-engineer (internal: behavioral research, pm, privacy, legal, qa, mobile, docs, data viz; conditional: brand, 3d-ui-ux) + the Product Designer / UX Researcher candidate draft',
    skillHref: 'research/skills/ui-ux-research-design-engineering/SKILL.md',
  },
];

export const SPECIALIST_CHARTERS: SpecialistCharter[] = [
  {
    file: 'software-architecture-principal.md',
    agent: 'Software Architecture Principal',
    context: 'architecture-database-backend-engineering',
    href: 'research/agents/software-architecture-principal.md',
  },
  {
    file: 'database-systems-engineer.md',
    agent: 'Database Systems Engineer',
    context: 'architecture-database-backend-engineering',
    href: 'research/agents/database-systems-engineer.md',
  },
  {
    file: 'backend-platform-staff-engineer.md',
    agent: 'Backend/Platform Staff Engineer',
    context: 'architecture-database-backend-engineering',
    href: 'research/agents/backend-platform-staff-engineer.md',
  },
  {
    file: 'product-ux-research-lead.md',
    agent: 'Product UX Research Lead',
    context: 'ui-ux-research-design-engineering',
    href: 'research/agents/product-ux-research-lead.md',
  },
  {
    file: 'design-systems-accessibility-engineer.md',
    agent: 'Design Systems & Accessibility Engineer',
    context: 'ui-ux-research-design-engineering',
    href: 'research/agents/design-systems-accessibility-engineer.md',
  },
  {
    file: 'interaction-prototyping-evaluation-specialist.md',
    agent: 'Interaction Prototyping & Evaluation Specialist',
    context: 'ui-ux-research-design-engineering',
    href: 'research/agents/interaction-prototyping-evaluation-specialist.md',
  },
];

export const SPECIALIST_DOWNLOADS: SpecialistDownload[] = [
  {
    file: 'architecture_database_backend_research.md',
    title: 'Architecture / database / backend research report',
    role: 'Verification-first source corpus, failure modes, 17 labs, 9 scored evaluation tasks',
    href: 'research/architecture_database_backend_research.md',
  },
  {
    file: 'ui_ux_theory_implementation_research.md',
    title: 'UI/UX theory-to-implementation research report',
    role: 'Perception/cognition evidence, standards currency, methods, recreated-project labs',
    href: 'research/ui_ux_theory_implementation_research.md',
  },
  {
    file: 'architecture_backend_repo_cases.json',
    title: 'Architecture repo casebook',
    role: '23 pinned repository cases (license, lifecycle, sha, learn/cannot-learn)',
    href: 'research/architecture_backend_repo_cases.json',
  },
  {
    file: 'ui_ux_repo_cases.json',
    title: 'UI/UX repo casebook',
    role: 'Pinned component/testing/prototyping repository cases',
    href: 'research/ui_ux_repo_cases.json',
  },
  {
    file: 'architecture_backend_role_resources.json',
    title: 'Architecture role-to-resource mapping',
    role: 'Per-context competencies, tiered resources, labs, linked standing slugs',
    href: 'research/architecture_backend_role_resources.json',
  },
  {
    file: 'ui_ux_role_resources.json',
    title: 'UI/UX role-to-resource mapping',
    role: 'Candidate inventory + per-charter resource focus',
    href: 'research/ui_ux_role_resources.json',
  },
  {
    file: 'labs_and_evaluation.md (architecture)',
    title: 'Architecture labs & evaluation',
    role: '17 implementation labs (incl. eShop reverse-architecture, PITR/tuning recovery) + 9 scored tasks',
    href: 'research/skills/architecture-database-backend-engineering/references/labs_and_evaluation.md',
  },
  {
    file: 'labs_and_evaluation.md (ui/ux)',
    title: 'UI/UX labs & evaluation',
    role: 'Recreated-project labs, charter evaluation checks, role/task mapping',
    href: 'research/skills/ui-ux-research-design-engineering/references/labs_and_evaluation.md',
  },
  {
    file: 'role_capability_and_resource_matrix.xlsx',
    title: 'Role capability & resource matrix workbook',
    role: '109 roles × 436 resources × 21 skill packs; 1,756 links, 336 role tasks + 5 ET-CAND',
    href: 'research/role_capability_and_resource_matrix.xlsx',
  },
];

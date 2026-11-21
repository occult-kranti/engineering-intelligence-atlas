/**
 * Executive operations (2026-11-21): the executive-operations-assistant
 * skill package (21st package) and its three agent charters, with source
 * artifacts bundled under /research/. Donna, the shared department
 * operations assistant, and the Repository Integration Steward are
 * DIGITAL-EMPLOYEE CONTEXTS mapped onto the EXISTING 109-role catalog
 * (assistant_skill_mapping.json; contract mappedRoleIds) — they are not new
 * standing roles, not provider workers: they add no resources, no
 * role-resource links, no evaluation tasks, no depth-score credit, and they
 * close no capability gaps. The single Product Designer / UX Researcher
 * candidate remains the only proposed role.
 */

export interface ExecutivePackage {
  id: string;
  name: string;
  contexts: string[];
  standingRoles: string;
  skillHref: string;
}

export interface ExecutiveCharter {
  file: string;
  agent: string;
  context: string;
  href: string;
}

export interface ExecutiveDownload {
  file: string;
  title: string;
  role: string;
  href: string;
}

export const EXECUTIVE_PACKAGES: ExecutivePackage[] = [
  {
    id: 'executive-operations-assistant',
    name: 'Executive Operations Assistant',
    contexts: [
      'donna-ceo-operations-assistant',
      'shared-department-operations-assistant',
      'repository-integration-knowledge-engineer',
    ],
    standingRoles:
      'agent-research-director-orchestration-lead, knowledge-transfer-learning-systems-manager (Donna + shared assistants); api-integration-engineer, knowledge-transfer-learning-systems-manager (repository steward, contract mappedRoleIds)',
    skillHref: 'research/skills/executive-operations-assistant/SKILL.md',
  },
];

export const EXECUTIVE_CHARTERS: ExecutiveCharter[] = [
  {
    file: 'donna-ceo-operations-assistant.md',
    agent: 'Donna — CEO Operations Assistant',
    context: 'executive-operations-assistant',
    href: 'research/agents/donna-ceo-operations-assistant.md',
  },
  {
    file: 'shared-department-operations-assistant.md',
    agent: 'Shared Department Operations Assistant',
    context: 'executive-operations-assistant',
    href: 'research/agents/shared-department-operations-assistant.md',
  },
  {
    file: 'repository-integration-knowledge-engineer.md',
    agent: 'Repository Integration Steward',
    context: 'executive-operations-assistant',
    href: 'research/agents/repository-integration-knowledge-engineer.md',
  },
];

export const EXECUTIVE_DOWNLOADS: ExecutiveDownload[] = [
  {
    file: 'donna_assistant_prompt_research.md',
    title: 'Donna assistant prompt research',
    role: 'Design basis: direct structured answers + short plans, guided action summaries (no raw CoT), escalation ladder, 12 baseline eval cases',
    href: 'research/donna_assistant_prompt_research.md',
  },
  {
    file: 'assistant-operations.fixture.json',
    title: 'Assistant operations golden fixture',
    role: 'Shared contract fixture (contractVersion 1): assistant definitions, 7 gates, 24-action policy table, schedule bounds, routing rules',
    href: 'research/assistant-operations.fixture.json',
  },
  {
    file: 'assistant_skill_mapping.json',
    title: 'Assistant skill mapping (matrix provenance)',
    role: '21st skill-pack mapping onto 3 existing roles; mapping only — no resources, edges, tasks, or standing roles; depth-invariance audit trail',
    href: 'research/assistant_skill_mapping.json',
  },
  {
    file: 'scripts/run_tests.py',
    title: 'Offline verifier suite',
    role: 'Deterministic stdlib-only checks over the fixture vectors: routing, action gates, schedule bounds, study queues, doc link hygiene',
    href: 'research/skills/executive-operations-assistant/scripts/run_tests.py',
  },
  {
    file: 'fixtures/ (executive samples)',
    title: 'Assistant action/schedule/study fixtures',
    role: 'Offline action-plan, repository, schedule, and study-queue fixtures derived from the shared assistant fixture',
    href: 'research/skills/executive-operations-assistant/fixtures/action_plans.fixture.json',
  },
];

/** Structural renderer copies of the native office-3 DTOs. No authority or
 * execution is implemented here; every mutation goes to the native bridge. */
export type StickyColor = 'yellow' | 'blue' | 'green' | 'pink' | 'purple' | 'gray';
/** Optional runtime-only evidence, absent from the website's native projection. */
export interface ImprovementCoordinatorStatus {
  sampledAt: string; enabled: boolean; checking: boolean;
  observation: {
    sessionId: string; sessionRevision: number; companyId: string; officeId: string; departmentId: string | null;
    checkedAt: string; outcome: 'checking' | 'blocked' | 'progress' | 'idle';
    reason: 'no-current-eligible-priced-route' | 'attempt-needs-review' | 'improvement-state-needs-review' | null;
  } | null;
}
export interface StickyNote {
  id: string; revision: number; companyId: string; officeId: string; departmentId: string | null;
  kind: 'comment' | 'todo'; color: StickyColor; text: string; status: 'open' | 'done' | 'archived';
  ownerEmployeeId: string | null; goalIds: string[]; x: number; y: number; createdAt: string; updatedAt: string;
}
export interface ImprovementAllowance {
  id: string; capUsd: number; carriedObservedUsd: number; carriedEstimatedUsd: number; sourceReference: string; createdAt: string;
}
export interface ImprovementRunSettings {
  mode: 'provider'; provider: 'anthropic' | 'openai' | 'ollama'; model: string; authorized: boolean;
  maxTokens: number; maxUsd: number; maxMinutes: number;
  priceRates: { inputUsdPerMillion: number | null; outputUsdPerMillion: number | null }; allowedTools?: string[];
}
export interface ImprovementSession {
  id: string; revision: number; companyId: string; officeId: string; departmentId: string | null;
  allowanceId: string; title: string; objective: string; primaryEmployeeId: string; reviewerEmployeeId: string;
  serviceContractId: string | null; reviewerServiceContractId: string | null; runSettings: ImprovementRunSettings;
  allowedRoutes: Array<{ provider: 'anthropic' | 'openai' | 'ollama'; model: string }>;
  continuation: 'until-budget' | 'backlog'; maxCycles: number | null; taskNoteIds: string[];
  cycle: number; activeGoalId: string | null; goalIds: string[]; activeNoteId: string | null; activeNoteRevision: number | null;
  status: 'paused' | 'active' | 'waiting-work' | 'waiting-budget' | 'needs-review' | 'completed' | 'cancelled';
  stopReason: string | null; recentArtifactSha256s: string[]; createdAt: string; updatedAt: string;
}
export interface ImprovementSnapshot {
  schemaVersion: number;
  companies: Array<{ id: string; name: string; status: string }>;
  offices: Array<{ id: string; companyId: string; name: string; status: string }>;
  departments: Array<{ id: string; companyId: string; officeId: string; name: string; status: string }>;
  employees: Array<{ id: string; companyId: string | null; officeId: string | null; departmentId: string | null; name: string; status: string }>;
  goals?: Array<{ id: string; companyId: string; title: string; scope: { kind: string; id: string }; status: string }>;
  jobs: Array<Record<string, unknown>>;
  portfolio?: { contracts: Array<{ id: string; status: string; recipientCompanyId: string; recipientOfficeId: string | null; recipientDepartmentId: string | null; employeeIds: string[] }> };
  stickyNotes?: StickyNote[]; improvementAllowance?: ImprovementAllowance | null; improvementSessions?: ImprovementSession[];
  improvementBudget?: { capUsd: number; carriedObservedUsd: number; carriedEstimatedUsd: number; observedUsd: number; estimatedUsd: number; reservedUsd: number; heldUsd: number; committedUsd: number; remainingUsd: number; effectiveRemainingUsd: number } | null;
  budget?: { remainingUsd: number | null; observedUsd: number; estimatedUsd: number; reservedUsd: number; heldUsd?: number; committedUsd: number };
}

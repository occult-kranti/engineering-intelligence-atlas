/**
 * Renderer-side DTO types for the v0.5 CEO Portfolio surface.
 *
 * Structural copies of the enterprise DTOs in src/shared/contract.ts and
 * src/shared/enterprise.ts (authoritative). The v5 bridge methods are
 * feature-detected by the adapter so the renderer degrades honestly against
 * a v4 bridge ("requires desktop 0.5 runtime").
 */

import type { BudgetLimits, PriceRates, ProjectProvider } from './types.js';

// ---- shared/enterprise structural copies (renderer subset) ----

export interface EnterpriseBudget {
  maxTokens: number;
  maxCalls: number;
  maxMinutes: number;
  maxCostUsdMicros: number;
}

export interface EnterpriseCompany {
  key: string;
  name: string;
  kind: 'line' | 'shared-services';
  mission: string;
  disciplines: string[];
  capacityShare: number;
}

export interface EnterpriseDepartment {
  key: string;
  companyKey: string;
  name: string;
  discipline: string;
}

export interface EnterpriseContractSpec {
  key: string;
  companyKey: string;
  departmentKey: string;
  discipline: string;
  status: string;
  version: number;
  capacityShare: number;
  skillPin: { skillId: string; version: string; sha256: string | null };
  staffed: boolean;
}

export interface EnterpriseBlueprint {
  /** Shared ENTERPRISE_CONTRACT_VERSION — numeric literal 1 on the wire. */
  contractVersion: 1;
  preset: string;
  programId: string;
  name: string;
  mission: string;
  budget: EnterpriseBudget;
  companies: EnterpriseCompany[];
  departments: EnterpriseDepartment[];
  contracts: EnterpriseContractSpec[];
  maxReplans: number;
  maxConcurrentRuns: number;
}

export interface CompanyRun {
  companyKey: string;
  runId: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'stopped';
}

export interface EnterpriseProgram {
  /** Shared ENTERPRISE_CONTRACT_VERSION — numeric literal 1 on the wire. */
  contractVersion: 1;
  programId: string;
  state: string;
  version: number;
  blueprintHash: string;
  companyRuns: CompanyRun[];
  maxReplans: number;
  maxConcurrentRuns: number;
  budget: EnterpriseBudget;
}

export interface EnterpriseViewNode {
  key: string;
  kind: 'enterprise' | 'company' | 'department' | 'contract';
  label: string;
  parentKey: string | null;
  status: string | null;
}

export interface EnterpriseViewEdge {
  key: string;
  from: string;
  to: string;
  kind: 'contains' | 'serves';
}

export interface EnterpriseCompanyRow {
  key: string;
  name: string;
  kind: 'line' | 'shared-services';
  capacityShare: number;
  disciplines: string[];
  departmentCount: number;
  contractCount: number;
}

export interface EnterpriseDepartmentRow {
  key: string;
  companyKey: string;
  name: string;
  discipline: string;
  contractCount: number;
}

export interface EnterpriseContractRow {
  key: string;
  companyKey: string;
  departmentKey: string;
  discipline: string;
  status: string;
  staffed: boolean;
  skillId: string;
}

export interface EnterpriseView {
  graph: { nodes: EnterpriseViewNode[]; edges: EnterpriseViewEdge[] };
  lists: {
    companies: EnterpriseCompanyRow[];
    departments: EnterpriseDepartmentRow[];
    contracts: EnterpriseContractRow[];
  };
}

export interface ArtifactRef {
  artifactId: string;
  runId: string;
  nodeKey: string;
  attempt: number;
  kind: string;
  title: string;
  summary: string;
  contentSha256: string;
}

export interface MemoryEntry {
  scope: string;
  scopeKey: string;
  artifact: ArtifactRef;
}

export interface WorkLedgerEntry {
  seq: number;
  ts: number;
  enterpriseId: string | null;
  companyKey: string | null;
  projectId: string | null;
  officeId: string | null;
  roomId: string | null;
  workerId: string | null;
  nodeKey: string | null;
  runId: string | null;
  attempt: number | null;
  kind: 'assignment' | 'prompt_started' | 'returned' | 'artifact' | 'approval' | 'waiting' | 'error';
  status: string;
  intendedAsk: string;
  promptSha256: string | null;
  returnedSummary: string;
  artifactRef: ArtifactRef | null;
  usage: { inputTokens: number; outputTokens: number; costUsdMicros: number } | null;
  skillRef: string | null;
}

export interface TimelineIndexEntry {
  seq: number;
  ts: number;
  kind: string;
  enterpriseId: string | null;
  companyKey: string | null;
  workerId: string | null;
  nodeKey: string | null;
  runId: string | null;
  ledgerSeq: number | null;
  artifactRef: ArtifactRef | null;
}

export interface StewardRecommendation {
  steward: string;
  kind: string;
  derivedBy: 'system';
  providerCalls: false;
  summary: string;
  refs: ArtifactRef[];
  ledgerSeq: number | null;
  actionId: string | null;
}

// ---- shared/contract v5 DTO structural copies ----

export interface EnterpriseSummaryDto {
  id: string;
  programId: string;
  name: string;
  state: 'draft' | 'materialized';
  version: number;
  blueprintHash: string | null;
  programState: string | null;
  programPaused: boolean;
  companyCount: number;
  departmentCount: number;
  contractCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface EnterpriseApprovalDto {
  id: string;
  kind: string;
  blueprintHash: string;
  payloadHash: string;
  payload: unknown;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  decidedAt: string | null;
}

export interface EnterpriseSeatLeaseDto {
  runId: string;
  fence: number;
  acquiredAt: string;
  expiresAt: string;
  ttlMs: number;
  status: 'active' | 'draining' | 'released';
}

export interface EnterpriseContractRuntimeDto {
  status: string;
  staffed: boolean;
  skillId: string;
  capacityShare: number;
  version: number;
  fenceCounter: number;
  lease: EnterpriseSeatLeaseDto | null;
}

export interface EnterpriseContractDto extends EnterpriseContractRuntimeDto {
  key: string;
  companyKey: string;
  departmentKey: string;
  discipline: string;
}

export interface EnterpriseMemoryDto {
  entry: MemoryEntry;
  status: 'promoted' | 'revoked';
  promotedAt: string;
  revokedAt: string | null;
}

export interface EnterpriseRecordDto {
  /** Shared ENTERPRISE_CONTRACT_VERSION — numeric literal 1 on the wire. */
  contractVersion: 1;
  id: string;
  programId: string;
  preset: string;
  name: string;
  mission: string;
  provider: ProjectProvider;
  model: string;
  priceRates: PriceRates;
  version: number;
  state: 'draft' | 'materialized';
  blueprint: EnterpriseBlueprint | null;
  blueprintHash: string | null;
  program: EnterpriseProgram | null;
  programPaused: boolean;
  companies: Record<string, { projectId: string; createdAt: string }>;
  departments: Record<string, { projectId: string; nodeId: string }>;
  contractWorkers: Record<string, { projectId: string; nodeId: string }>;
  contracts: Record<string, EnterpriseContractRuntimeDto>;
  approvals: EnterpriseApprovalDto[];
  memory: EnterpriseMemoryDto[];
  workerOverrides: Record<string, { instructions?: string; budget?: Partial<BudgetLimits> }>;
  ledgerKeys: string[];
  ledgerSeq: number;
  eventSeq: number;
  createdAt: string;
  updatedAt: string;
}

export interface EnterpriseSnapshotDto {
  record: EnterpriseRecordDto;
  view: EnterpriseView | null;
  stewards: StewardRecommendation[];
}

export interface CreateEnterpriseRequest {
  preset: string;
  programId: string;
  name: string;
  mission: string;
  budget: EnterpriseBudget;
  maxReplans?: number;
  maxConcurrentRuns?: number;
  provider: ProjectProvider;
  model: string;
  priceRates?: PriceRates;
}

export interface EnterpriseBlueprintPreviewDto {
  blueprint: EnterpriseBlueprint;
  blueprintHash: string;
  payload: unknown;
  payloadHash: string;
  expectedVersion: number;
  approval: EnterpriseApprovalDto;
}

export interface EnterpriseEventDto {
  seq: number;
  ts: string;
  event: string;
  detail?: string;
}

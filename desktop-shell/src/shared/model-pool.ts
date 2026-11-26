/** Public metadata only. Model-server URLs, registry paths and credentials stay in the main process. */
export type ModelRequestStatus = 'queued' | 'pulling' | 'ready' | 'failed' | 'cancelled' | 'interrupted';
export interface ModelScope { companyId: string; employeeId?: string }
export interface ModelPullInput { companyId: string; employeeId: string; model: string; idempotencyKey: string; maxBytes?: number }
export interface ModelCancelInput { companyId: string; employeeId: string; requestId: string }
export interface ModelSelectInput { companyId: string; employeeId: string; model: string }
export interface ModelCatalogEntry {
  id: string; name: string; description: string; storageCeilingBytes: number; sourceUrl: string;
  upstreamUrl?: string; architecture?: 'dense' | 'moe'; totalParametersBillions?: number;
  activeParametersBillions?: number; quantization?: string; contextLimitTokens?: number;
  /** Published approximate download bytes, not measured RAM/VRAM or readiness. */
  artifactApproxBytes?: number; license?: string;
}
export interface SharedModel { name: string; digest: string; sizeBytes: number; loaded: boolean }
export interface ModelRequestRecord { id: string; companyId: string; employeeId: string; model: string; status: ModelRequestStatus; completedBytes: number; totalBytes: number; error: string | null }
export interface ModelAssignment { companyId: string; employeeId: string; model: string; digest: string }
export interface ModelPoolSnapshot {
  companyId: string; available: boolean; enabled: boolean; endpoint: string; infrastructureCost: 'separate';
  catalog: readonly ModelCatalogEntry[]; models: SharedModel[]; requests: ModelRequestRecord[]; assignments: ModelAssignment[]; error: string | null;
}
export interface ModelPoolResult { ok: true; snapshot: ModelPoolSnapshot; requestId?: string; replayed?: boolean; reused?: boolean }

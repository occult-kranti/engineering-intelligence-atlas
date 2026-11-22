export interface MutationResult<T> { ok: boolean; snapshot?: T | null; code?: string; error?: string; queued?: boolean }
export type OwnerMutation = Record<string, unknown> & { action: string; requestId: string };
export interface PendingMutation { readonly command: OwnerMutation; readonly state: 'sending' | 'uncertain' }
const REJECTED = new Set(['INVALID_INPUT', 'INVALID_ESTIMATE', 'INVALID_DEPENDENCY', 'PAIR_REQUIRED', 'PAIR_BUDGET',
  'SCOPE_MISMATCH', 'SERVICE_CONTRACT_REQUIRED', 'REVIEW_REQUIRED', 'CAPACITY', 'NOT_FOUND', 'REVISION_CONFLICT',
  'STALE_REVISION', 'DISPATCH_PERMISSION_REVOKED', 'INVALID_TRANSITION', 'ALLOWANCE_EXISTS', 'ALLOWANCE_REQUIRED',
  'IMMUTABLE_SCOPE', 'BUDGET_EXCEEDED', 'PERMISSION_DENIED', 'REVISION_REQUIRED', 'ALREADY_EXISTS', 'TERMINAL_STATE',
  'IMPROVEMENT_ALLOWANCE_IMMUTABLE', 'IMPROVEMENT_ALLOWANCE_REQUIRED', 'IMPROVEMENT_BUDGET', 'IMPROVEMENT_ROUTE_DENIED', 'UNSETTLED_ATTEMPT',
  'CLOUD_COMMAND_REJECTED', 'CLOUD_COMMAND_CANCELLED', 'NOTE_KIND_IMMUTABLE']);

/** One unresolved owner operation at a time. Unknown/transport/queued outcomes
 * retain exact bytes and request identity; editing never creates a second one. */
export function createMutationController<T>(send: (command: OwnerMutation) => Promise<MutationResult<T>>, changed: () => void = () => {}) {
  let pending: { command: OwnerMutation; body: string; state: 'sending' | 'uncertain' } | null = null;
  let disposed = false;
  const inspect = (): PendingMutation | null => pending ? { command: structuredClone(pending.command), state: pending.state } : null;
  async function dispatch(command?: OwnerMutation): Promise<T> {
    if (disposed) throw new Error('This surface is closed.');
    if (pending?.state === 'sending') throw new Error('Wait for the current request acknowledgement.');
    if (!pending && !command) throw new Error('There is no saved request to retry.');
    if (command && pending && JSON.stringify(command) !== pending.body) throw new Error('An outcome is unconfirmed. Retry the saved request before changing its body, scope or revision. Your draft is kept.');
    if (!pending) { const body = JSON.stringify(command); pending = { command: JSON.parse(body) as OwnerMutation, body, state: 'sending' }; }
    pending.state = 'sending'; changed();
    try {
      const result = await send(structuredClone(pending.command));
      if (disposed) throw new Error('The surface closed before the acknowledgement. Inspect native state when reopening.');
      if (!result.ok || !result.snapshot || result.queued) {
        const code = result.code || 'OUTCOME_UNKNOWN';
        if (!result.queued && REJECTED.has(code)) pending = null;
        throw new Error(`${code}: ${result.error || (result.queued ? 'The website command is queued; acknowledgement is still pending.' : 'No native acknowledgement was received.')}`);
      }
      pending = null; changed(); return result.snapshot;
    } catch (error) {
      if (pending) pending.state = 'uncertain';
      if (!disposed) changed();
      throw error;
    }
  }
  return { dispatch, pending: inspect, dispose() { disposed = true; } };
}

export function newOwnerId(prefix: string): string {
  const bytes = new Uint8Array(16); globalThis.crypto.getRandomValues(bytes);
  return `${prefix}-${Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('')}`;
}

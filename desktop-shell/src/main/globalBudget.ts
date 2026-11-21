import crypto from 'node:crypto';
import type { OfficeCommand, OfficeResult } from '../shared/office';
import type { GenerateFn } from './projects';
export class GlobalBudgetPause extends Error { readonly code = 'GLOBAL_BUDGET_PAUSED'; constructor(){ super('Global budget admission is paused. The request was not sent; increase the budget or wait, then resume.'); } }
/** Adds atomic cross-workspace admission to the legacy project runner. */
export function withGlobalBudget(generate: GenerateFn, command: (request: OfficeCommand) => Promise<OfficeResult>): GenerateFn {
  return async request => {
    const rates = request.billing;
    if (!rates) throw new Error('Global billing context is required for this run.');
    if (![rates.inputUsdPerMillion, rates.outputUsdPerMillion].every(n => Number.isFinite(n) && n >= 0) || (request.provider !== 'ollama' && (rates.inputUsdPerMillion <= 0 || rates.outputUsdPerMillion <= 0))) throw new Error('Valid positive input and output rates are required for cloud billing.');
    const inputBound = Buffer.byteLength(request.system + request.prompt, 'utf8') + 256;
    const maxTokens = inputBound + request.maxOutputTokens;
    const reservedUsd = request.provider === 'ollama' ? 0 : (inputBound * rates.inputUsdPerMillion + request.maxOutputTokens * rates.outputUsdPerMillion) / 1e6;
    if (!Number.isFinite(reservedUsd) || reservedUsd < 0) throw new Error('Invalid billing rates.');
    const attemptId = `project-${crypto.randomUUID()}`;
    const admission = await command({ action: 'reserve_external', attemptId, source: rates.source, reservedUsd, maxTokens });
    if (!admission.ok) throw new Error(admission.error || 'Global budget admission failed.');
    if (admission.snapshot?.lastAction?.reserved === false) throw new GlobalBudgetPause();
    if (admission.snapshot?.lastAction?.reserved !== true || admission.snapshot.lastAction.attemptId !== attemptId) throw new Error('Global budget reservation could not be verified. No provider request was sent.');
    let result: Awaited<ReturnType<GenerateFn>>;
    try { result = await generate(request); }
    catch(error) {
      await command({ action: 'settle_external', attemptId, inputTokens: inputBound, outputTokens: request.maxOutputTokens, costUsd: reservedUsd, costStatus: 'estimated' }).catch(()=>undefined);
      throw error;
    }
    const observed = result.usageObserved !== false && [result.inputTokens,result.outputTokens].every(n=>Number.isSafeInteger(n)&&n>=0);
    const costUsd = !observed ? reservedUsd : request.provider==='ollama' ? 0 : (result.inputTokens*rates.inputUsdPerMillion+result.outputTokens*rates.outputUsdPerMillion)/1e6;
    const settlement = await command({ action:'settle_external', attemptId, inputTokens:observed?result.inputTokens:inputBound, outputTokens:observed?result.outputTokens:request.maxOutputTokens, costUsd, costStatus:observed?'observed':'estimated' }).catch(()=>null);
    // Preserve returned work even when the ledger cannot be finalized. The
    // persisted reservation continues to count against the global ceiling.
    return settlement?.ok && observed ? result : {...result,usageObserved:false};
  };
}

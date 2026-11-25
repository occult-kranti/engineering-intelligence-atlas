/** Match the native global-policy ceiling. Per-job limits remain independent. */
export const MAX_GLOBAL_CEILING_USD = 1_000_000;
export function validGlobalCeiling(value: number): boolean {
  return Number.isFinite(value) && value > 0 && value <= MAX_GLOBAL_CEILING_USD;
}

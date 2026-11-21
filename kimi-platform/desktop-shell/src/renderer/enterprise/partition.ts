/**
 * Budget partitioning (Hamilton / largest-remainder apportionment), ported
 * 1:1 from src/shared/enterprise.ts so the CEO surface can render honest
 * per-company partitions + usage meters without a bridge round-trip. The
 * shared function is the authority for dispatch; this copy is display-only
 * and is pinned byte-for-byte by tests against the shared implementation.
 *
 * BigInt arithmetic keeps rounding exact at any budget scale. Inactive
 * companies receive a zero reservation.
 */

import type { EnterpriseBudget } from '../office/entTypes.js';

export interface EnterpriseReservation {
  maxTokens: number;
  maxCalls: number;
  maxMinutes: number;
  maxCostUsdMicros: number;
}

export interface PartitionRequest {
  companyKey: string;
  capacityShare: number;
  active: boolean;
}

export interface BudgetPartition {
  companyKey: string;
  active: boolean;
  capacityShare: number;
  reservation: EnterpriseReservation;
}

export interface PartitionResult {
  envelope: EnterpriseBudget;
  partitions: BudgetPartition[];
  /** Sum over ACTIVE reservations only. */
  totals: EnterpriseReservation;
  /** Proof flag: totals <= envelope in every dimension. */
  withinEnvelope: boolean;
}

function partitionUnits(totalUnits: bigint, requests: readonly PartitionRequest[]): Map<string, bigint> {
  const out = new Map<string, bigint>();
  for (const r of requests) out.set(r.companyKey, 0n);
  const active = requests.filter((r) => r.active);
  if (active.length === 0 || totalUnits <= 0n) return out;
  const weightSum = active.reduce((acc, r) => acc + BigInt(r.capacityShare), 0n);
  const quotas = active.map((r) => {
    const product = totalUnits * BigInt(r.capacityShare);
    return { key: r.companyKey, floor: product / weightSum, remainder: product % weightSum };
  });
  let leftover = totalUnits - quotas.reduce((acc, q) => acc + q.floor, 0n);
  const order = [...quotas].sort((a, b) => {
    if (a.remainder !== b.remainder) return a.remainder > b.remainder ? -1 : 1;
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  });
  for (const q of order) {
    if (leftover <= 0n) break;
    q.floor += 1n;
    leftover -= 1n;
  }
  for (const q of quotas) out.set(q.key, q.floor);
  return out;
}

/**
 * Partition an enterprise budget envelope across companies; provably
 * sum(active reservations) <= envelope in every dimension (by construction).
 */
export function partitionBudget(envelope: EnterpriseBudget, requests: readonly PartitionRequest[]): PartitionResult {
  const tokens = partitionUnits(BigInt(envelope.maxTokens), requests);
  const calls = partitionUnits(BigInt(envelope.maxCalls), requests);
  const minutes = partitionUnits(BigInt(Math.round(envelope.maxMinutes * 1000)), requests);
  const micros = partitionUnits(BigInt(envelope.maxCostUsdMicros), requests);

  const partitions: BudgetPartition[] = requests.map((r) => ({
    companyKey: r.companyKey,
    active: r.active,
    capacityShare: r.capacityShare,
    reservation: {
      maxTokens: Number(tokens.get(r.companyKey) ?? 0n),
      maxCalls: Number(calls.get(r.companyKey) ?? 0n),
      maxMinutes: Number(minutes.get(r.companyKey) ?? 0n) / 1000,
      maxCostUsdMicros: Number(micros.get(r.companyKey) ?? 0n),
    },
  }));

  let totalTokens = 0n;
  let totalCalls = 0n;
  let totalMinutesMilli = 0n;
  let totalMicros = 0n;
  for (const p of partitions) {
    if (!p.active) continue;
    totalTokens += tokens.get(p.companyKey) ?? 0n;
    totalCalls += calls.get(p.companyKey) ?? 0n;
    totalMinutesMilli += minutes.get(p.companyKey) ?? 0n;
    totalMicros += micros.get(p.companyKey) ?? 0n;
  }
  const totals: EnterpriseReservation = {
    maxTokens: Number(totalTokens),
    maxCalls: Number(totalCalls),
    maxMinutes: Number(totalMinutesMilli) / 1000,
    maxCostUsdMicros: Number(totalMicros),
  };
  const withinEnvelope =
    totals.maxTokens <= envelope.maxTokens &&
    totals.maxCalls <= envelope.maxCalls &&
    totals.maxMinutes <= envelope.maxMinutes &&
    totals.maxCostUsdMicros <= envelope.maxCostUsdMicros;
  return { envelope, partitions, totals, withinEnvelope };
}

import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc-client";

/**
 * Data hooks for the CEO enterprise dashboard. Every read is a pure query
 * (no run advancement, no provider calls server-side); every write is an
 * explicit human mutation through trpc.enterprise.*. Queries do not poll
 * aggressively: the snapshot invalidates on content (version + event seq),
 * so manual refetch after mutations is the norm.
 */

export function useEnterpriseList() {
  return trpc.enterprise.list.useQuery(undefined, { retry: false });
}

export function useEnterpriseActions() {
  return trpc.enterprise.actions.useQuery(undefined, { retry: false });
}

export function useEnterpriseSnapshot(enterpriseId: number) {
  return trpc.enterprise.snapshot.useQuery({ enterpriseId }, { retry: false });
}

export function useEnterpriseWorkers(enterpriseId: number) {
  return trpc.enterprise.workers.useQuery({ enterpriseId }, { retry: false });
}

export function useEnterpriseMemory(enterpriseId: number) {
  return trpc.enterprise.listMemory.useQuery({ enterpriseId }, { retry: false });
}

export function useArtifactSearch(enterpriseId: number, query: string, enabled: boolean) {
  return trpc.enterprise.searchArtifacts.useQuery(
    { enterpriseId, query, limit: 25 },
    { retry: false, enabled },
  );
}

export interface KeysetPage<T> {
  entries: T[];
  total: number | null;
  hasMore: boolean;
  loading: boolean;
  error: string | null;
  loadMore(): void;
}

interface SeqEntry {
  seq: number;
}

/**
 * Keyset accumulation for the derived ledger / timeline / audit events. One
 * query at a time: "load more" advances the afterSeq cursor, pages append
 * (deduped by seq so a refetch never doubles a row), and the server-reported
 * total is shown honestly. No fake progress: an exhausted stream says so.
 */
export function useKeysetPages<T extends SeqEntry>(
  enterpriseId: number,
  source: "ledger" | "timeline" | "events",
  pageSize = 100,
): KeysetPage<T> {
  const [cursor, setCursor] = useState(0);
  const [exhausted, setExhausted] = useState(false);
  const [acc, setAcc] = useState<{ entries: T[]; next: number | null; total: number | null }>({
    entries: [],
    next: null,
    total: null,
  });
  const scopeKey = `${source}:${enterpriseId}:${pageSize}`;
  const consumedScope = useRef(scopeKey);

  // Reset accumulation when the scope (enterprise / source / page size) changes.
  useEffect(() => {
    consumedScope.current = scopeKey;
    setCursor(0);
    setExhausted(false);
    setAcc({ entries: [], next: null, total: null });
  }, [scopeKey]);

  const args = { enterpriseId, afterSeq: cursor, limit: pageSize };
  const enabled = !exhausted && consumedScope.current === scopeKey;
  const q =
    source === "ledger"
      ? trpc.enterprise.ledger.useQuery(args, { retry: false, enabled })
      : source === "timeline"
        ? trpc.enterprise.timeline.useQuery(args, { retry: false, enabled })
        : trpc.enterprise.events.useQuery(args, { retry: false, enabled });

  useEffect(() => {
    if (!q.data || consumedScope.current !== scopeKey) return;
    // ledger/timeline return {entries, nextAfterSeq, total}; events returns rows.
    const data = q.data as unknown as
      | { entries: T[]; nextAfterSeq: number | null; total: number }
      | T[];
    const batch = Array.isArray(data) ? data : data.entries;
    const explicitNext = Array.isArray(data) ? undefined : data.nextAfterSeq;
    const explicitTotal = Array.isArray(data) ? undefined : data.total;
    const next =
      explicitNext !== undefined
        ? explicitNext
        : batch.length === pageSize
          ? (batch[batch.length - 1]?.seq ?? null)
          : null;
    setAcc((prev) => {
      const seen = new Set(prev.entries.map((e) => e.seq));
      const fresh = batch.filter((e) => !seen.has(e.seq));
      return {
        entries: fresh.length ? [...prev.entries, ...fresh] : prev.entries,
        next,
        total: explicitTotal ?? prev.total,
      };
    });
    if (next === null) setExhausted(true);
  }, [q.data, scopeKey, pageSize]);

  return {
    entries: acc.entries,
    total: acc.total,
    hasMore: !exhausted && acc.next !== null && !q.error,
    loading: q.isLoading,
    error: q.error ? q.error.message : null,
    loadMore: () => {
      if (acc.next !== null && !exhausted) setCursor(acc.next);
    },
  };
}

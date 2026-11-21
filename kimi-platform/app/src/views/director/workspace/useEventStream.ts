import { useState } from "react";
import { trpc } from "@/lib/trpc-client";
import type { EventLike } from "./adapter";

/**
 * Append-only run event tail (2 s poll, dedupe by seq). Pauses when the tab
 * is hidden (react-query refetchInterval is only armed while focused).
 * Shared by the operations deck console and the announcer.
 */
export function useEventStream(runId: number | null, active: boolean) {
  const [afterSeq, setAfterSeq] = useState(0);
  const [events, setEvents] = useState<EventLike[]>([]);

  const tailQ = trpc.events.tail.useQuery(
    { runId: runId ?? 0, afterSeq, limit: 200 },
    { enabled: runId != null, refetchInterval: active ? 2000 : 5000, retry: false },
  );

  // Merge polled batches (adjust-during-render so the stream lands without a
  // post-render cascading effect). Dedupe by seq.
  const [prevTail, setPrevTail] = useState<typeof tailQ.data>(undefined);
  if (tailQ.data !== prevTail) {
    setPrevTail(tailQ.data);
    if (tailQ.data?.length) {
      const batch = tailQ.data;
      setEvents((prev) => {
        const seen = new Set(prev.map((e) => e.seq));
        return [...prev, ...batch.filter((e) => !seen.has(e.seq))]
          .sort((a, b) => a.seq - b.seq)
          .slice(-400);
      });
      setAfterSeq(batch[batch.length - 1]!.seq);
    }
  }

  // Honest stream age comes from the server's own event timestamps.
  const last = events[events.length - 1];
  const lastEventAt =
    last?.createdAt != null ? new Date(last.createdAt).getTime() : null;

  return { events, lastEventAt, error: tailQ.error?.message ?? null };
}

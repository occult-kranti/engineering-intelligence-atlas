import type { Availability, WbRevisionMeta } from "./model";

/**
 * Append-only version history. Opening an old revision is read-only;
 * restore creates a new head — history is never rewritten.
 */
export default function VersionRail({
  revisions,
  currentRevision,
  onOpen,
  onRestore,
  pending = false,
}: {
  revisions: Availability<WbRevisionMeta[]>;
  currentRevision: number | null;
  onOpen?: (revision: number) => void;
  onRestore?: (revision: number) => void;
  pending?: boolean;
}) {
  return (
    <section aria-labelledby="wb-history-heading">
      <h2 id="wb-history-heading" className="kicker">
        Version history · collision-safe (OCC)
      </h2>
      {revisions.status === "unavailable" ? (
        <p className="chip chip-neutral mt-1" role="status">
          history unavailable — {revisions.reason}
        </p>
      ) : revisions.data.length === 0 ? (
        <p className="mt-1 text-[13px] text-[hsl(var(--ink-soft))]">
          no saved revisions yet — the first save appends rev 1.
        </p>
      ) : (
        <ol className="mt-1 flex flex-col gap-1">
          {revisions.data.map((r) => {
            const isCurrent = r.revision === currentRevision;
            return (
              <li
                key={r.revision}
                className="flex min-h-[44px] flex-wrap items-center gap-2 border-b border-[hsl(var(--ink)/0.1)] py-1"
                data-revision={r.revision}
              >
                <span className="mono text-[13px] font-bold">rev {r.revision}</span>
                <span className="text-[13px]">{r.author}</span>
                <span className="text-[12px] text-[hsl(var(--ink-soft))]">— {r.note}</span>
                {r.nodeCount != null ? (
                  <span className="mono text-[11px] text-[hsl(var(--ink-soft))]">
                    {r.nodeCount}n/{r.edgeCount ?? 0}e
                  </span>
                ) : null}
                <span className="ml-auto inline-flex gap-1">
                  {isCurrent ? (
                    <span className="chip chip-cornflower">current</span>
                  ) : (
                    <>
                      {onOpen ? (
                        <button
                          type="button"
                          className="btn min-h-[44px] px-2 text-[12px]"
                          onClick={() => onOpen(r.revision)}
                        >
                          Open (read-only)
                        </button>
                      ) : null}
                      {onRestore ? (
                        <button
                          type="button"
                          className="btn min-h-[44px] px-2 text-[12px]"
                          disabled={pending}
                          onClick={() => onRestore(r.revision)}
                          aria-label={`Restore revision ${r.revision} as a new revision`}
                        >
                          Restore
                        </button>
                      ) : null}
                    </>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

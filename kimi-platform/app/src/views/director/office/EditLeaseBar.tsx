import type { Availability, EditLeaseInfo } from "./model";
import { fmtCountdown } from "./derive";

/**
 * Single-writer edit lease bar. A second tab/owner sees read-only +
 * lease countdown + an explicit Take over (fenced: the stale holder's next
 * save gets 409 fenced and keeps its work as an unsaved local copy).
 */
export default function EditLeaseBar({
  lease,
  onAcquire,
  onTakeOver,
  pending = false,
}: {
  lease: Availability<EditLeaseInfo>;
  onAcquire?: () => void;
  onTakeOver?: () => void;
  pending?: boolean;
}) {
  if (lease.status === "unavailable") {
    return (
      <p className="chip chip-neutral" role="status">
        edit lease unavailable — {lease.reason}
      </p>
    );
  }
  const l = lease.data;
  if (l.heldByYou) {
    return (
      <p className="chip chip-sage" role="status">
        <span aria-hidden>●</span> editing lease · {l.holder} · {fmtCountdown(l.expiresInSec)}
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2" role="status">
      <span className="chip chip-mustard">
        locked — {l.holder}, lease {fmtCountdown(l.expiresInSec)}
      </span>
      <span className="text-[12px] text-[hsl(var(--ink-soft))]">read-only until the lease lapses</span>
      {onTakeOver ? (
        <button
          type="button"
          className="btn min-h-[44px] px-3 text-[13px]"
          disabled={pending}
          onClick={onTakeOver}
        >
          Take over
        </button>
      ) : null}
      {onAcquire ? (
        <button
          type="button"
          className="btn min-h-[44px] px-3 text-[13px]"
          disabled={pending}
          onClick={onAcquire}
        >
          Request edit lease
        </button>
      ) : null}
    </div>
  );
}

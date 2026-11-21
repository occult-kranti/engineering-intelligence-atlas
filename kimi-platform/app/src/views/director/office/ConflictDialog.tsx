export interface SaveConflict {
  /** Server cause verbatim: version_conflict | fenced. */
  cause: string;
  message: string;
}

/**
 * The 409 dialog — three honest options, no last-writer-wins:
 * reload latest (yours kept as a local JSON download), save yours as a new
 * revision (deterministic rebase — bindings keyed by dagNodeKey), or cancel.
 */
export default function ConflictDialog({
  conflict,
  onReloadLatest,
  onSaveAsNew,
  onCancel,
  pending = false,
}: {
  conflict: SaveConflict | null;
  onReloadLatest: () => void;
  onSaveAsNew: () => void;
  onCancel: () => void;
  pending?: boolean;
}) {
  if (!conflict) return null;
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="wb-conflict-title"
      aria-describedby="wb-conflict-desc"
      className="border-2 border-[hsl(var(--alert))] bg-[hsl(var(--paper-raised))] p-4"
    >
      <h2 id="wb-conflict-title" className="text-[15px] font-extrabold">
        Save conflict — {conflict.cause}
      </h2>
      <p id="wb-conflict-desc" className="prose-evidence mt-1 text-[14px] text-[hsl(var(--ink-soft))]">
        {conflict.message} The whiteboard never silently overwrites: pick how to proceed.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          className="btn min-h-[44px] px-4 text-[13px]"
          disabled={pending}
          onClick={onReloadLatest}
        >
          Reload latest
          <span className="ml-1 text-[12px] text-[hsl(var(--ink-soft))]">
            (yours kept as a local JSON download)
          </span>
        </button>
        <button
          type="button"
          className="btn min-h-[44px] px-4 text-[13px] font-bold"
          disabled={pending}
          onClick={onSaveAsNew}
        >
          Save mine as new revision
          <span className="ml-1 text-[12px] text-[hsl(var(--ink-soft))]">(rebase onto latest)</span>
        </button>
        <button
          type="button"
          className="btn min-h-[44px] px-4 text-[13px]"
          disabled={pending}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

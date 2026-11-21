import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface ConfirmRequest {
  title: string;
  body: string;
  confirmLabel: string;
  destructive?: boolean;
  run(): void;
}

/**
 * The single confirmation dialog for enterprise mutations. Every gated or
 * destructive CEO control (contract decide/release, program cancel, memory
 * decisions) routes through an explicit confirm — never a bare click.
 */
export default function ConfirmDialog({
  request,
  pending,
  onClose,
}: {
  request: ConfirmRequest | null;
  pending: boolean;
  onClose(): void;
}) {
  return (
    <Dialog open={request !== null} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{request?.title ?? "Confirm"}</DialogTitle>
          <DialogDescription>{request?.body ?? ""}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button type="button" className="btn text-[13px]" onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn text-[13px] font-bold ${request?.destructive ? "border-[hsl(var(--alert))] text-[hsl(8_64%_30%)]" : "border-[hsl(var(--ink))]"}`}
            disabled={pending}
            onClick={() => request?.run()}
          >
            {pending ? "Working…" : (request?.confirmLabel ?? "Confirm")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

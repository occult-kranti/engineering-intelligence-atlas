import { useState } from "react";
import type { WbExportFormat, WhiteboardDoc } from "./model";
import { whiteboardExportJson, whiteboardToSvg } from "./derive";

export interface WbExportPayload {
  format: WbExportFormat;
  /** Always present — every offered format carries its bytes. */
  content?: string;
  mime: string;
  revision: number;
}

/**
 * Export menu — SVG (self-contained, data-revision) and JSON (doc + bound
 * plan hash + timestamp), byte-exact client downloads. PNG was dropped:
 * no honest DOM→PNG renderer exists without new dependencies, and the
 * menu never advertises what the host cannot do. Provenance is explicit;
 * note bodies export verbatim; secrets are never included.
 */
export default function ExportMenu({
  doc,
  onExport,
  disabled = false,
}: {
  doc: WhiteboardDoc;
  /** Host performs the actual download/share; receives honest payloads. */
  onExport: (payload: WbExportPayload) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pick = (format: WbExportFormat) => {
    setOpen(false);
    if (format === "svg") {
      onExport({ format, content: whiteboardToSvg(doc), mime: "image/svg+xml", revision: doc.revision });
    } else {
      onExport({
        format,
        content: whiteboardExportJson(doc, new Date().toISOString()),
        mime: "application/json",
        revision: doc.revision,
      });
    }
  };
  return (
    <div className="relative inline-block">
      <button
        type="button"
        className="btn min-h-[44px] px-4 text-[13px]"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        Export ▾
      </button>
      {open ? (
        <ul
          role="menu"
          aria-label="Export whiteboard"
          className="absolute right-0 z-10 mt-1 min-w-56 border border-[hsl(var(--ink))] bg-[hsl(var(--paper-raised))]"
        >
          {(
            [
              ["svg", "SVG — self-contained, fonts embedded"],
              ["json", "JSON — document + plan hash + timestamp"],
            ] as [WbExportFormat, string][]
          ).map(([fmt, label]) => (
            <li key={fmt} role="none">
              <button
                type="button"
                role="menuitem"
                className="block min-h-[44px] w-full px-3 py-2 text-left text-[13px] hover:bg-[hsl(var(--cornflower)/0.12)]"
                onClick={() => pick(fmt)}
              >
                <span className="mono font-bold uppercase">{fmt}</span>{" "}
                <span className="text-[hsl(var(--ink-soft))]">{label}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

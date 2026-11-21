import { useId, useState } from 'react';

/**
 * Expand variant that only mounts its children after the first open, so heavy
 * (lazy-loaded) detail content is never rendered for collapsed rows. Once
 * mounted, children stay mounted to preserve inner state (e.g. active tab)
 * and the collapse transition. Markup and styling mirror the shared Expand
 * component.
 */
export function ExpandOnDemand({
  header,
  children,
  className = '',
}: {
  header: (open: boolean) => React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const id = useId();
  return (
    <div className={className}>
      <button
        type="button"
        className="flex min-h-[44px] w-full items-start justify-between gap-3 p-4 text-left"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          setOpen((v) => !v);
          setHasOpened(true);
        }}
      >
        {header(open)}
        <span
          className="mono mt-1 shrink-0 text-[11px] uppercase tracking-wider text-[hsl(var(--ink-soft))]"
          aria-hidden="true"
        >
          {open ? '− close' : '+ open'}
        </span>
      </button>
      <div className="expand-region" data-open={open} id={id}>
        <div>
          {hasOpened ? (
            <div className="border-t border-[hsl(var(--line))] p-4">{children}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

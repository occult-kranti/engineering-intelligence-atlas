import { useId, useState } from 'react';

/**
 * Expandable section with a purposeful height transition
 * (grid-rows 0fr → 1fr; collapsed instantly under reduced motion).
 */
export function Expand({
  header,
  children,
  className = '',
  defaultOpen = false,
}: {
  header: (open: boolean) => React.ReactNode;
  children: React.ReactNode;
  className?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className={className}>
      <button
        type="button"
        className="flex min-h-[44px] w-full items-start justify-between gap-3 p-4 text-left"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
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
          <div className="border-t border-[hsl(var(--line))] p-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

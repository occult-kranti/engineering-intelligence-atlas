import { fmt } from '@/lib/format';

export function Stat({
  value,
  label,
  note,
  dark = false,
}: {
  value: number | string;
  label: string;
  note?: string;
  dark?: boolean;
}) {
  return (
    <div
      className={`border-l py-0.5 pl-4 ${
        dark
          ? 'border-[hsl(40_10%_30%)] text-[hsl(var(--dark-ink))]'
          : 'border-[hsl(var(--ink))]'
      }`}
    >
      <div className="mono text-2xl font-bold tracking-tight md:text-3xl">
        {typeof value === 'number' ? fmt(value) : value}
      </div>
      <div
        className={`mt-1 text-[11px] font-semibold uppercase tracking-wider ${
          dark ? 'text-[hsl(var(--dark-ink-soft))]' : 'text-[hsl(var(--ink-soft))]'
        }`}
      >
        {label}
      </div>
      {note ? (
        <div
          className={`mt-1 text-[11px] ${
            dark ? 'text-[hsl(var(--dark-ink-soft))]' : 'text-[hsl(var(--ink-soft))]'
          }`}
        >
          {note}
        </div>
      ) : null}
    </div>
  );
}

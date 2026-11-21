export function SectionHeader({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <p className="kicker mb-2">{kicker}</p>
      <h2 className="text-balance text-2xl font-extrabold tracking-tight md:text-3xl">
        {title}
      </h2>
      {children ? (
        <p className="prose-evidence mt-3 max-w-3xl text-sm text-[hsl(var(--ink-soft))] md:text-base">
          {children}
        </p>
      ) : null}
    </div>
  );
}

export function SubHead({
  children,
  id,
}: {
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <h3 id={id} className="mb-3 border-b border-[hsl(var(--ink))] pb-2 text-lg font-bold tracking-tight">
      {children}
    </h3>
  );
}

/** Annotation / evidence side-note with a ruled left edge and serif prose. */
export function EvidenceNote({
  title,
  children,
  accent = 'mustard',
}: {
  title: string;
  children: React.ReactNode;
  accent?: 'mustard' | 'sage' | 'cornflower';
}) {
  const color =
    accent === 'mustard'
      ? 'hsl(var(--mustard))'
      : accent === 'sage'
        ? 'hsl(var(--sage))'
        : 'hsl(var(--cornflower))';
  return (
    <aside
      className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-4"
      style={{ borderLeftWidth: 3, borderLeftColor: color }}
    >
      <p className="kicker mb-1">{title}</p>
      <div className="prose-evidence text-sm">{children}</div>
    </aside>
  );
}

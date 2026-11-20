import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Pagination({
  page,
  pageCount,
  onPage,
  total,
  pageSize,
}: {
  page: number;
  pageCount: number;
  onPage: (p: number) => void;
  total: number;
  pageSize: number;
}) {
  if (pageCount <= 1) return null;
  const from = page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  return (
    <nav
      className="mt-4 flex flex-wrap items-center justify-between gap-2"
      aria-label="Pagination"
    >
      <p className="mono text-xs text-[hsl(var(--ink-soft))]" aria-live="polite">
        {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn"
          onClick={() => onPage(Math.max(0, page - 1))}
          disabled={page === 0}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Prev</span>
        </button>
        <span className="mono px-1 text-xs font-semibold">
          {String(page + 1).padStart(2, '0')} / {String(pageCount).padStart(2, '0')}
        </span>
        <button
          type="button"
          className="btn"
          onClick={() => onPage(Math.min(pageCount - 1, page + 1))}
          disabled={page >= pageCount - 1}
          aria-label="Next page"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}

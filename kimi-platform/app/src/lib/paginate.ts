export function paginate<T>(items: T[], page: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const clamped = Math.min(page, pageCount - 1);
  return {
    pageCount,
    page: clamped,
    slice: items.slice(clamped * pageSize, clamped * pageSize + pageSize),
  };
}

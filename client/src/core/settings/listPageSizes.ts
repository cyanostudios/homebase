/** Shared list page sizes for paginated catalog-style lists (products, orders, etc.). */

export type ListPageSize = 25 | 50 | 100 | 150 | 200 | 250;

export const LIST_PAGE_SIZE_OPTIONS: ListPageSize[] = [25, 50, 100, 150, 200, 250];

export const DEFAULT_LIST_PAGE_SIZE: ListPageSize = 100;

export function normalizeListPageSize(value: unknown): ListPageSize {
  const n = Number(value);
  return LIST_PAGE_SIZE_OPTIONS.includes(n as ListPageSize)
    ? (n as ListPageSize)
    : DEFAULT_LIST_PAGE_SIZE;
}

/** Rows with a non-empty name are sent to create. */
export function getNamedBulkRows<T extends { name: string }>(rows: T[]): T[] {
  return rows.filter((row) => row.name.trim());
}

/**
 * After partial failure: drop successfully created named rows;
 * keep empty rows and rows that failed.
 */
export function retainFailedOrEmptyBulkRows<T extends { id: string; name: string }>(
  rows: T[],
  failedIds: ReadonlySet<string>,
): T[] {
  return rows.filter((row) => !row.name.trim() || failedIds.has(row.id));
}

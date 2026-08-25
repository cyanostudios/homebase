export type InvoiceColumnCount = 1 | 2 | 3;

export const INVOICES_SETTINGS_KEY = 'invoices';
export const INVOICES_COLUMN_COUNT_STORAGE_KEY = 'invoices:columnCount';

export function isInvoiceColumnCount(value: unknown): value is InvoiceColumnCount {
  return value === 1 || value === 2 || value === 3;
}

/** Prefer columnCount; migrate legacy viewMode (grid→3, list→1). Default 1. */
export function resolveInvoiceColumnCount(
  settings:
    | {
        columnCount?: unknown;
        viewMode?: unknown;
      }
    | null
    | undefined,
): InvoiceColumnCount {
  if (isInvoiceColumnCount(settings?.columnCount)) {
    return settings.columnCount;
  }
  if (
    typeof settings?.columnCount === 'string' &&
    isInvoiceColumnCount(Number(settings.columnCount))
  ) {
    return Number(settings.columnCount) as InvoiceColumnCount;
  }
  if (settings?.viewMode === 'grid') {
    return 3;
  }
  return 1;
}

export function parseStoredInvoiceColumnCount(raw: string | null): InvoiceColumnCount | null {
  if (raw === null || raw === '') {
    return null;
  }
  const n = Number(raw);
  return isInvoiceColumnCount(n) ? n : null;
}

export function getInitialInvoiceColumnCount(): InvoiceColumnCount {
  if (typeof window === 'undefined') {
    return 1;
  }
  const fromColumn = parseStoredInvoiceColumnCount(
    window.sessionStorage.getItem(INVOICES_COLUMN_COUNT_STORAGE_KEY),
  );
  if (fromColumn !== null) {
    return fromColumn;
  }
  const legacy = window.sessionStorage.getItem('invoices:viewMode');
  if (legacy === 'grid') {
    return 3;
  }
  return 1;
}

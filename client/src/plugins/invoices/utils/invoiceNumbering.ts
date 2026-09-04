/** Invoice number series settings (user_settings category `invoices`). */

export const DEFAULT_INVOICE_NUMBER_PREFIX = '';
export const DEFAULT_INVOICE_NUMBER_START = 1;
export const DEFAULT_INVOICE_INCLUDE_YEAR = true;
export const MAX_INVOICE_NUMBER_PREFIX_LENGTH = 12;
export const MAX_INVOICE_NUMBER_START = 999_999;

export type InvoiceNumberingPref = {
  numberPrefix: string;
  numberStart: number;
  /** When true: PREFIX-YYYY-NNN or YYYY-NNN. When false: PREFIX-NNN or NNN. */
  includeYear: boolean;
};

/** Letters/digits only, uppercased, max length. Empty = no letter prefix. */
export function sanitizeInvoiceNumberPrefix(raw: unknown): string {
  if (typeof raw !== 'string') {
    return DEFAULT_INVOICE_NUMBER_PREFIX;
  }
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, MAX_INVOICE_NUMBER_PREFIX_LENGTH);
}

export function sanitizeInvoiceNumberStart(raw: unknown): number {
  const n =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string' && raw.trim() !== ''
        ? Number(raw)
        : NaN;
  if (!Number.isFinite(n) || n < 1) {
    return DEFAULT_INVOICE_NUMBER_START;
  }
  return Math.min(Math.floor(n), MAX_INVOICE_NUMBER_START);
}

export function sanitizeInvoiceIncludeYear(raw: unknown): boolean {
  if (typeof raw === 'boolean') {
    return raw;
  }
  if (raw === 'false' || raw === 0 || raw === '0') {
    return false;
  }
  if (raw === 'true' || raw === 1 || raw === '1') {
    return true;
  }
  // Missing key → default on (backward compatible with existing PREFIX-YYYY-NNN series).
  return DEFAULT_INVOICE_INCLUDE_YEAR;
}

export function normalizeInvoiceNumbering(
  settings:
    | { numberPrefix?: unknown; numberStart?: unknown; includeYear?: unknown }
    | null
    | undefined,
): InvoiceNumberingPref {
  return {
    numberPrefix: sanitizeInvoiceNumberPrefix(settings?.numberPrefix),
    numberStart: sanitizeInvoiceNumberStart(settings?.numberStart),
    includeYear: sanitizeInvoiceIncludeYear(settings?.includeYear),
  };
}

export function invoiceNumberingEqual(a: InvoiceNumberingPref, b: InvoiceNumberingPref): boolean {
  return (
    a.numberPrefix === b.numberPrefix &&
    a.numberStart === b.numberStart &&
    a.includeYear === b.includeYear
  );
}

export function formatInvoiceNumberParts(
  pref: Pick<InvoiceNumberingPref, 'numberPrefix' | 'includeYear'>,
  year: number,
  sequence: number,
): string {
  const seq = String(sequence).padStart(3, '0');
  if (pref.includeYear) {
    return pref.numberPrefix ? `${pref.numberPrefix}-${year}-${seq}` : `${year}-${seq}`;
  }
  return pref.numberPrefix ? `${pref.numberPrefix}-${seq}` : seq;
}

/** Example of the next allocated number for the current year (not uniqueness-checked). */
export function formatInvoiceNumberExample(
  pref: InvoiceNumberingPref,
  year: number = new Date().getFullYear(),
): string {
  return formatInvoiceNumberParts(pref, year, pref.numberStart);
}

/**
 * True when the stored number already includes a letter prefix
 * (`INV-2026-001`, `F-100`, …). Those should be shown as-is (no extra `INV-`).
 */
export function invoiceNumberHasStoredPrefix(numberOrId: string): boolean {
  const value = String(numberOrId ?? '').trim();
  return /^[A-Za-z][A-Za-z0-9]*-\d{4}-\d+$/.test(value) || /^[A-Za-z][A-Za-z0-9]*-\d+$/.test(value);
}

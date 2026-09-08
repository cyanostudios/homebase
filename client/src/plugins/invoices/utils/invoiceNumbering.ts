/** Invoice number series settings (user_settings category `invoices`). */

export const DEFAULT_INVOICE_NUMBER_PREFIX = '';
export const DEFAULT_INVOICE_NUMBER_START = 1;
export const DEFAULT_INVOICE_INCLUDE_YEAR = true;
export const MAX_INVOICE_NUMBER_PREFIX_LENGTH = 12;
export const MAX_INVOICE_NUMBER_START = 999_999;

/** Document types with independent numbering series. */
export const INVOICE_NUMBERING_TYPES = [
  'invoice',
  'credit_note',
  'cash_invoice',
  'receipt',
] as const;

export type InvoiceNumberingType = (typeof INVOICE_NUMBERING_TYPES)[number];

export type InvoiceNumberingPref = {
  numberPrefix: string;
  numberStart: number;
  /** When true: PREFIX-YYYY-NNN or YYYY-NNN. When false: PREFIX-NNN or NNN. */
  includeYear: boolean;
};

export type InvoiceNumberingByType = Record<InvoiceNumberingType, InvoiceNumberingPref>;

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

export function sanitizeInvoiceNumberingType(raw: unknown): InvoiceNumberingType {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if ((INVOICE_NUMBERING_TYPES as readonly string[]).includes(value)) {
    return value as InvoiceNumberingType;
  }
  return 'invoice';
}

function defaultInvoiceNumberingPref(): InvoiceNumberingPref {
  return normalizeInvoiceNumbering(null);
}

/**
 * Hydrate per-type series from settings.
 * Prefer `numberingByType`; otherwise lift flat keys onto `invoice`.
 */
export function normalizeInvoiceNumberingByType(
  settings:
    | {
        numberPrefix?: unknown;
        numberStart?: unknown;
        includeYear?: unknown;
        numberingByType?: unknown;
      }
    | null
    | undefined,
): InvoiceNumberingByType {
  const byType = settings?.numberingByType;
  const hasByType = Boolean(byType && typeof byType === 'object' && !Array.isArray(byType));
  const source = hasByType ? (byType as Record<string, unknown>) : null;

  const result = {} as InvoiceNumberingByType;
  for (const type of INVOICE_NUMBERING_TYPES) {
    if (hasByType && source?.[type] != null && typeof source[type] === 'object') {
      result[type] = normalizeInvoiceNumbering(
        source[type] as {
          numberPrefix?: unknown;
          numberStart?: unknown;
          includeYear?: unknown;
        },
      );
    } else if (!hasByType && type === 'invoice') {
      result[type] = normalizeInvoiceNumbering(settings);
    } else {
      result[type] = defaultInvoiceNumberingPref();
    }
  }
  return result;
}

export function resolveInvoiceNumberingForType(
  settings: Parameters<typeof normalizeInvoiceNumberingByType>[0],
  type: unknown,
): InvoiceNumberingPref {
  const normalizedType = sanitizeInvoiceNumberingType(type);
  return normalizeInvoiceNumberingByType(settings)[normalizedType];
}

/** Persist full numberingByType and mirror invoice series onto flat keys. */
export function buildInvoiceNumberingSettingsPayload(
  numberingByType: InvoiceNumberingByType | Record<string, InvoiceNumberingPref>,
): {
  numberingByType: InvoiceNumberingByType;
  numberPrefix: string;
  numberStart: number;
  includeYear: boolean;
} {
  const normalized = normalizeInvoiceNumberingByType({ numberingByType });
  const invoiceSeries = normalized.invoice;
  return {
    numberingByType: normalized,
    numberPrefix: invoiceSeries.numberPrefix,
    numberStart: invoiceSeries.numberStart,
    includeYear: invoiceSeries.includeYear,
  };
}

export function invoiceNumberingEqual(a: InvoiceNumberingPref, b: InvoiceNumberingPref): boolean {
  return (
    a.numberPrefix === b.numberPrefix &&
    a.numberStart === b.numberStart &&
    a.includeYear === b.includeYear
  );
}

export function invoiceNumberingByTypeEqual(
  a: InvoiceNumberingByType,
  b: InvoiceNumberingByType,
): boolean {
  return INVOICE_NUMBERING_TYPES.every((type) => invoiceNumberingEqual(a[type], b[type]));
}

/** Types that share the same prefix + includeYear as the given type (excluding itself). */
export function findInvoiceNumberingSeriesCollisions(
  byType: InvoiceNumberingByType,
  type: InvoiceNumberingType,
): InvoiceNumberingType[] {
  const target = byType[type];
  return INVOICE_NUMBERING_TYPES.filter((other) => {
    if (other === type) {
      return false;
    }
    const series = byType[other];
    return series.numberPrefix === target.numberPrefix && series.includeYear === target.includeYear;
  });
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

/**
 * Client-side ML VAT compliance helpers (mirror of Architect epics A–E).
 * Server remains authority; these gate UX and validate() only.
 */

export const INVOICE_VAT_RATES = [0, 6, 12, 25] as const;
export type InvoiceVatRate = (typeof INVOICE_VAT_RATES)[number];

/** Simplified document ceiling (SEK incl. VAT) — expert input ML 17:26. */
export const FORENKLAD_TOTAL_CEILING_SEK = 4000;

export type InvoiceContentProfile = 'full' | 'simplified';

export function isInvoiceIssued(status?: string | null): boolean {
  return String(status || 'draft').trim() !== 'draft';
}

/** Client may set these on an already-issued invoice (ledger owns paid / partially_paid). */
export const ISSUED_CLIENT_STATUS_ALLOWLIST = ['sent', 'overdue', 'canceled'] as const;

export const INVOICE_STATUS_SELECT_OPTIONS = [
  'draft',
  'sent',
  'partially_paid',
  'paid',
  'overdue',
  'canceled',
] as const;

/**
 * Status options for the select control.
 * When `issuedLocked`, Draft is omitted; paid/partially_paid only appear if already current
 * (ledger-owned — not offered as new client assignments).
 */
export function getInvoiceStatusSelectOptions(
  currentStatus?: string | null,
  { issuedLocked }: { issuedLocked?: boolean } = {},
): string[] {
  const current = String(currentStatus || 'draft').trim() || 'draft';
  const locked = issuedLocked ?? isInvoiceIssued(current);

  if (!locked) {
    return [...INVOICE_STATUS_SELECT_OPTIONS];
  }

  const options = new Set<string>(ISSUED_CLIENT_STATUS_ALLOWLIST);
  if (current && current !== 'draft') {
    options.add(current);
  }
  return INVOICE_STATUS_SELECT_OPTIONS.filter((option) => options.has(option));
}

/**
 * Issued status change: id + status only (QA B2). Draft/issue still needs a full payload.
 */
export function buildInvoiceStatusUpdatePayload(
  invoice: { id?: string | number | null; status?: string | null },
  newStatus: string,
): { id: string | number; status: string } | null {
  if (invoice?.id == null || String(invoice.id).trim() === '') {
    return null;
  }
  if (!isInvoiceIssued(invoice.status)) {
    return null;
  }
  if (newStatus === 'draft') {
    return null;
  }
  return { id: invoice.id, status: newStatus };
}

/** True when the payload is a status-only PUT for an already-issued document. */
export function isInvoiceStatusOnlyPayload(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') {
    return false;
  }
  const data = raw as Record<string, unknown>;
  if (data.id == null || data.status == null) {
    return false;
  }
  const keys = Object.keys(data).filter((key) => data[key] !== undefined);
  return keys.every((key) => key === 'id' || key === 'status');
}

export function isAllowedInvoiceVatRate(rate: unknown): boolean {
  const n = Number(rate);
  return INVOICE_VAT_RATES.includes(n as InvoiceVatRate);
}

export function canCreateCreditNoteFromInvoiceMl(invoice: {
  invoiceType?: string | null;
  status?: string | null;
}): boolean {
  return (invoice.invoiceType || 'invoice') === 'invoice' && isInvoiceIssued(invoice.status);
}

/**
 * Derive document profile for display / issue checks.
 * invoice + credit_note always full; receipt/cash_invoice may be simplified under gate.
 */
export function deriveInvoiceContentProfile(input: {
  invoiceType?: string | null;
  currency?: string | null;
  total?: number | null;
}): InvoiceContentProfile {
  const type = String(input.invoiceType || 'invoice').trim();
  if (type === 'invoice' || type === 'credit_note') {
    return 'full';
  }
  if (type !== 'receipt' && type !== 'cash_invoice') {
    return 'full';
  }
  const currency = String(input.currency || 'SEK')
    .trim()
    .toUpperCase();
  const totalInclVat = Math.abs(Number(input.total || 0));
  if (currency === 'SEK' && totalInclVat <= FORENKLAD_TOTAL_CEILING_SEK) {
    return 'simplified';
  }
  return 'full';
}

export type InvoiceVatBreakdownRow = {
  rate: number;
  taxBase: number;
  vatAmount: number;
};

/**
 * Per-rate tax base + VAT after line and invoice discounts (same proportion as totals).
 * Does not alter calculateInvoiceTotals parity with server.
 */
export function buildInvoiceVatBreakdown(
  lineItems:
    | Array<{
        kind?: string;
        quantity?: number;
        unitPrice?: number;
        discount?: number;
        discountAmount?: number;
        lineSubtotal?: number;
        vatRate?: number;
      }>
    | null
    | undefined,
  invoiceDiscount: number = 0,
): InvoiceVatBreakdownRow[] {
  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    return [];
  }

  const pricedItems = lineItems.filter((item) => item && item.kind !== 'text');
  let subtotal = 0;
  let totalDiscount = 0;
  pricedItems.forEach((item) => {
    const lineSubtotal = item.lineSubtotal ?? (item.quantity || 0) * (item.unitPrice || 0);
    const discountAmount = item.discountAmount ?? lineSubtotal * ((item.discount || 0) / 100);
    subtotal += lineSubtotal;
    totalDiscount += discountAmount;
  });

  const subtotalAfterDiscount = subtotal - totalDiscount;
  const invoiceDiscountAmount = subtotalAfterDiscount * (Number(invoiceDiscount || 0) / 100);
  const subtotalAfterInvoiceDiscount = subtotalAfterDiscount - invoiceDiscountAmount;

  const byRate = new Map<number, { taxBase: number; vatAmount: number }>();

  pricedItems.forEach((item) => {
    const lineSubtotal = item.lineSubtotal ?? (item.quantity || 0) * (item.unitPrice || 0);
    const lineDiscountAmount = item.discountAmount ?? lineSubtotal * ((item.discount || 0) / 100);
    const lineAfterDiscount = lineSubtotal - lineDiscountAmount;
    const rate = Number(item.vatRate ?? 25);
    let taxBase = 0;
    let vatAmount = 0;
    if (subtotalAfterDiscount > 0) {
      const proportion = lineAfterDiscount / subtotalAfterDiscount;
      taxBase = subtotalAfterInvoiceDiscount * proportion;
      vatAmount = taxBase * (rate / 100);
    }
    const prev = byRate.get(rate) || { taxBase: 0, vatAmount: 0 };
    byRate.set(rate, {
      taxBase: prev.taxBase + taxBase,
      vatAmount: prev.vatAmount + vatAmount,
    });
  });

  return [...byRate.entries()]
    .filter(([, row]) => Math.abs(row.taxBase) > 0.0001 || Math.abs(row.vatAmount) > 0.0001)
    .sort((a, b) => b[0] - a[0])
    .map(([rate, row]) => ({
      rate,
      taxBase: Math.round(row.taxBase * 100) / 100,
      vatAmount: Math.round(row.vatAmount * 100) / 100,
    }));
}

export type InvoiceMlValidationInput = {
  status?: string | null;
  invoiceType?: string | null;
  currency?: string | null;
  lineItems?: Array<{ kind?: string; vatRate?: number }> | null;
  invoiceDiscount?: number | null;
  total?: number | null;
  creditedInvoiceId?: string | number | null;
  correctionSummary?: string | null;
  /** When true, apply leave-draft / issue-time rules (currency, rates, credit link, förenklad). */
  issuing?: boolean;
};

export type InvoiceMlValidationError = { field: string; message: string };

/**
 * Client validate mirror. Messages are English defaults; form/provider maps via i18n keys when preferred.
 * Soft draft save: only structural credit-note link when type is credit_note.
 * Issue-time (`issuing`): full gate.
 */
export function validateInvoiceMlClient(
  data: InvoiceMlValidationInput,
  t?: (key: string, opts?: Record<string, unknown>) => string,
): InvoiceMlValidationError[] {
  const translate = (key: string, defaultValue: string, opts?: Record<string, unknown>) =>
    t ? t(key, { defaultValue, ...opts }) : defaultValue;

  const errors: InvoiceMlValidationError[] = [];
  const type = String(data.invoiceType || 'invoice').trim();
  const currency = String(data.currency || 'SEK')
    .trim()
    .toUpperCase();
  const issuing = data.issuing === true || (isInvoiceIssued(data.status) && data.issuing !== false);

  if (type === 'credit_note') {
    if (data.creditedInvoiceId == null || String(data.creditedInvoiceId).trim() === '') {
      errors.push({
        field: 'creditedInvoiceId',
        message: translate(
          'invoices.validation.creditLinkRequired',
          'Credit notes must link to an original invoice.',
        ),
      });
    }
    if (!String(data.correctionSummary || '').trim()) {
      errors.push({
        field: 'correctionSummary',
        message: translate(
          'invoices.validation.correctionSummaryRequired',
          'Describe what changed versus the original invoice.',
        ),
      });
    }
  }

  if (!issuing) {
    return errors;
  }

  const lines = Array.isArray(data.lineItems) ? data.lineItems : [];
  for (const item of lines) {
    if (item?.kind === 'text') continue;
    if (!isAllowedInvoiceVatRate(item?.vatRate ?? 25)) {
      errors.push({
        field: 'lineItems',
        message: translate(
          'invoices.validation.vatRateInvalid',
          'VAT rate must be 0%, 6%, 12%, or 25%.',
        ),
      });
      break;
    }
  }

  if (type === 'receipt' || type === 'cash_invoice') {
    const totalInclVat = Math.abs(Number(data.total || 0));
    if (currency === 'SEK' && totalInclVat > FORENKLAD_TOTAL_CEILING_SEK) {
      // Over ceiling is allowed only as full profile — not an error by itself.
      // Soft hint is handled in UI; no block if full fields present.
    }
  }

  return errors;
}

/** Invoice currency options (aligned with Contacts / Estimates). */
export const INVOICE_CURRENCY_OPTIONS = ['SEK', 'EUR', 'USD', 'NOK', 'DKK'] as const;

export function resolveInvoiceCurrency(currency?: string | null): string {
  const code = String(currency || 'SEK')
    .trim()
    .toUpperCase();
  return (INVOICE_CURRENCY_OPTIONS as readonly string[]).includes(code) ? code : 'SEK';
}

/** Map contact taxRate (string %) onto an allowed invoice VAT rate. */
export function resolveInvoiceVatRateFromContact(taxRate?: string | number | null): number {
  const n = Number(taxRate);
  if (isAllowedInvoiceVatRate(n)) {
    return n;
  }
  return 25;
}

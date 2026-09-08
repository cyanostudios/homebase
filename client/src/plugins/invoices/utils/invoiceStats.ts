import type { Invoice } from '../types/invoices';
import { INVOICE_NUMBERING_TYPES, type InvoiceNumberingType } from './invoiceNumbering';
import { resolveInvoiceTotals } from './invoiceTotals';

/** Money totals keyed by ISO currency — never sum across keys. */
export type AmountByCurrency = Record<string, number>;

export type InvoiceStatsBucket = {
  count: number;
  byCurrency: AmountByCurrency;
};

export type InvoiceStatsByType = Record<InvoiceNumberingType, InvoiceStatsBucket>;

export type InvoiceStatsData = {
  outstanding: InvoiceStatsBucket;
  overdue: InvoiceStatsBucket;
  paid: InvoiceStatsBucket;
  draft: InvoiceStatsBucket;
  sent: InvoiceStatsBucket;
  partiallyPaid: InvoiceStatsBucket;
  canceled: InvoiceStatsBucket;
  byType: InvoiceStatsByType;
  partialPayments: number;
  totalInvoicedByCurrency: AmountByCurrency;
  totalCollectedByCurrency: AmountByCurrency;
  invoiceCount: number;
  /** Distinct currencies present (SEK first, then A–Z). */
  currencies: string[];
};

export function normalizeInvoiceCurrency(currency?: string | null): string {
  const raw = String(currency || 'SEK')
    .trim()
    .toUpperCase();
  return raw || 'SEK';
}

export function emptyAmounts(): AmountByCurrency {
  return {};
}

export function addCurrencyAmount(
  map: AmountByCurrency,
  currency: string | null | undefined,
  amount: number,
): void {
  const code = normalizeInvoiceCurrency(currency);
  map[code] = Math.round(((map[code] || 0) + amount) * 100) / 100;
}

/** SEK first, then alphabetical. */
export function sortInvoiceCurrencies(codes: Iterable<string>): string[] {
  return Array.from(new Set(Array.from(codes).map(normalizeInvoiceCurrency))).sort((a, b) => {
    if (a === 'SEK') return -1;
    if (b === 'SEK') return 1;
    return a.localeCompare(b);
  });
}

export function currencyAmountEntries(
  byCurrency: AmountByCurrency,
): Array<{ currency: string; amount: number }> {
  return sortInvoiceCurrencies(Object.keys(byCurrency))
    .map((currency) => ({ currency, amount: byCurrency[currency] || 0 }))
    .filter((row) => row.amount !== 0);
}

function emptyBucket(): InvoiceStatsBucket {
  return { count: 0, byCurrency: emptyAmounts() };
}

function emptyByType(): InvoiceStatsByType {
  return {
    invoice: emptyBucket(),
    credit_note: emptyBucket(),
    cash_invoice: emptyBucket(),
    receipt: emptyBucket(),
  };
}

function addToBucket(
  bucket: InvoiceStatsBucket,
  amount: number,
  currency: string | null | undefined,
) {
  bucket.count += 1;
  addCurrencyAmount(bucket.byCurrency, currency, amount);
}

function resolveInvoiceType(invoice: Invoice): InvoiceNumberingType {
  const raw = String(invoice.invoiceType || 'invoice').trim();
  return (INVOICE_NUMBERING_TYPES as readonly string[]).includes(raw)
    ? (raw as InvoiceNumberingType)
    : 'invoice';
}

function isCreditNote(invoice: Invoice): boolean {
  return resolveInvoiceType(invoice) === 'credit_note';
}

/** Remaining balance; credit notes contribute a negative remaining (reduce net outstanding). */
function openRemaining(total: number, amountPaid: number, credit: boolean): number {
  const remaining = Math.round((total - amountPaid) * 100) / 100;
  if (credit) {
    return remaining;
  }
  return Math.max(0, remaining);
}

function collectCurrencies(...maps: AmountByCurrency[]): string[] {
  const codes = new Set<string>();
  for (const map of maps) {
    for (const code of Object.keys(map)) {
      codes.add(code);
    }
  }
  return sortInvoiceCurrencies(codes);
}

/** Client-side invoice KPIs. Money is tracked per currency (no FX conversion). */
export function computeInvoiceStats(invoices: Invoice[]): InvoiceStatsData {
  const data: InvoiceStatsData = {
    outstanding: emptyBucket(),
    overdue: emptyBucket(),
    paid: emptyBucket(),
    draft: emptyBucket(),
    sent: emptyBucket(),
    partiallyPaid: emptyBucket(),
    canceled: emptyBucket(),
    byType: emptyByType(),
    partialPayments: 0,
    totalInvoicedByCurrency: emptyAmounts(),
    totalCollectedByCurrency: emptyAmounts(),
    invoiceCount: invoices.length,
    currencies: [],
  };

  for (const invoice of invoices) {
    const total = resolveInvoiceTotals(invoice).total;
    const amountPaid = Number(invoice.amountPaid || 0);
    const status = invoice.status || 'draft';
    const type = resolveInvoiceType(invoice);
    const credit = isCreditNote(invoice);
    const currency = normalizeInvoiceCurrency(invoice.currency);

    addToBucket(data.byType[type], total, currency);
    addCurrencyAmount(data.totalInvoicedByCurrency, currency, total);

    if (!credit) {
      addCurrencyAmount(
        data.totalCollectedByCurrency,
        currency,
        Math.min(amountPaid, Math.max(total, 0)),
      );
    }

    if (
      !credit &&
      (status === 'partially_paid' ||
        (amountPaid > 0 &&
          amountPaid + 0.001 < total &&
          status !== 'paid' &&
          status !== 'canceled'))
    ) {
      data.partialPayments += 1;
    }

    if (status === 'draft') {
      addToBucket(data.draft, total, currency);
    } else if (status === 'sent') {
      addToBucket(data.sent, total, currency);
      addCurrencyAmount(
        data.outstanding.byCurrency,
        currency,
        openRemaining(total, amountPaid, credit),
      );
      data.outstanding.count += 1;
    } else if (status === 'partially_paid') {
      addToBucket(data.partiallyPaid, total, currency);
      addCurrencyAmount(
        data.outstanding.byCurrency,
        currency,
        openRemaining(total, amountPaid, credit),
      );
      data.outstanding.count += 1;
    } else if (status === 'overdue') {
      addToBucket(data.overdue, total, currency);
      addCurrencyAmount(
        data.outstanding.byCurrency,
        currency,
        openRemaining(total, amountPaid, credit),
      );
      data.outstanding.count += 1;
    } else if (status === 'paid') {
      addToBucket(data.paid, total, currency);
    } else if (status === 'canceled') {
      addToBucket(data.canceled, total, currency);
    }
  }

  data.currencies = collectCurrencies(
    data.totalInvoicedByCurrency,
    data.totalCollectedByCurrency,
    data.outstanding.byCurrency,
    data.overdue.byCurrency,
    data.paid.byCurrency,
    data.draft.byCurrency,
    data.sent.byCurrency,
    data.partiallyPaid.byCurrency,
    data.canceled.byCurrency,
    data.byType.invoice.byCurrency,
    data.byType.credit_note.byCurrency,
    data.byType.cash_invoice.byCurrency,
    data.byType.receipt.byCurrency,
  );

  return data;
}

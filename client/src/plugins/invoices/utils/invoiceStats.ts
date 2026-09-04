import type { Invoice } from '../types/invoices';
import { resolveInvoiceTotals } from './invoiceTotals';

export type InvoiceStatsBucket = {
  count: number;
  totalAmount: number;
};

export type InvoiceStatsData = {
  outstanding: InvoiceStatsBucket;
  overdue: InvoiceStatsBucket;
  paid: InvoiceStatsBucket;
  draft: InvoiceStatsBucket;
  sent: InvoiceStatsBucket;
  partiallyPaid: InvoiceStatsBucket;
  canceled: InvoiceStatsBucket;
  partialPayments: number;
  totalInvoiced: number;
  totalCollected: number;
  invoiceCount: number;
};

function emptyBucket(): InvoiceStatsBucket {
  return { count: 0, totalAmount: 0 };
}

function addToBucket(bucket: InvoiceStatsBucket, amount: number) {
  bucket.count += 1;
  bucket.totalAmount = Math.round((bucket.totalAmount + amount) * 100) / 100;
}

/** Client-side invoice KPIs (Matches-style aggregation). */
export function computeInvoiceStats(invoices: Invoice[]): InvoiceStatsData {
  const data: InvoiceStatsData = {
    outstanding: emptyBucket(),
    overdue: emptyBucket(),
    paid: emptyBucket(),
    draft: emptyBucket(),
    sent: emptyBucket(),
    partiallyPaid: emptyBucket(),
    canceled: emptyBucket(),
    partialPayments: 0,
    totalInvoiced: 0,
    totalCollected: 0,
    invoiceCount: invoices.length,
  };

  for (const invoice of invoices) {
    const total = resolveInvoiceTotals(invoice).total;
    const amountPaid = Number(invoice.amountPaid || 0);
    const status = invoice.status || 'draft';

    data.totalInvoiced = Math.round((data.totalInvoiced + total) * 100) / 100;
    data.totalCollected =
      Math.round((data.totalCollected + Math.min(amountPaid, total)) * 100) / 100;

    if (
      status === 'partially_paid' ||
      (amountPaid > 0 && amountPaid + 0.001 < total && status !== 'paid' && status !== 'canceled')
    ) {
      data.partialPayments += 1;
    }

    if (status === 'draft') {
      addToBucket(data.draft, total);
    } else if (status === 'sent') {
      addToBucket(data.sent, total);
      addToBucket(data.outstanding, Math.max(0, total - amountPaid));
    } else if (status === 'partially_paid') {
      addToBucket(data.partiallyPaid, total);
      addToBucket(data.outstanding, Math.max(0, total - amountPaid));
    } else if (status === 'overdue') {
      addToBucket(data.overdue, total);
      addToBucket(data.outstanding, Math.max(0, total - amountPaid));
    } else if (status === 'paid') {
      addToBucket(data.paid, total);
    } else if (status === 'canceled') {
      addToBucket(data.canceled, total);
    }
  }

  return data;
}

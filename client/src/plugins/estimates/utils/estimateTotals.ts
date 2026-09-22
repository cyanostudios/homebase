import { resolveInvoiceTotals, type InvoiceTotals } from '@/plugins/invoices/utils/invoiceTotals';

import type { Estimate, LineItem } from '../types/estimate';

export type EstimateTotals = {
  subtotal: number;
  totalDiscount: number;
  subtotalAfterDiscount: number;
  estimateDiscountAmount: number;
  subtotalAfterEstimateDiscount: number;
  totalVat: number;
  total: number;
};

export type EstimateTotalsSource = Pick<
  Estimate,
  | 'lineItems'
  | 'estimateDiscount'
  | 'subtotal'
  | 'totalDiscount'
  | 'subtotalAfterDiscount'
  | 'estimateDiscountAmount'
  | 'subtotalAfterEstimateDiscount'
  | 'totalVat'
  | 'total'
>;

function mapInvoiceTotals(raw: InvoiceTotals): EstimateTotals {
  return {
    subtotal: raw.subtotal,
    totalDiscount: raw.totalDiscount,
    subtotalAfterDiscount: raw.subtotalAfterDiscount,
    estimateDiscountAmount: raw.invoiceDiscountAmount,
    subtotalAfterEstimateDiscount: raw.subtotalAfterInvoiceDiscount,
    totalVat: raw.totalVat,
    total: raw.total,
  };
}

export function resolveEstimateTotals(source: EstimateTotalsSource): EstimateTotals {
  const raw = resolveInvoiceTotals({
    lineItems: (source.lineItems ?? []) as LineItem[],
    invoiceDiscount: source.estimateDiscount ?? 0,
    subtotal: source.subtotal,
    totalDiscount: source.totalDiscount,
    subtotalAfterDiscount: source.subtotalAfterDiscount,
    invoiceDiscountAmount: source.estimateDiscountAmount,
    subtotalAfterInvoiceDiscount: source.subtotalAfterEstimateDiscount,
    totalVat: source.totalVat,
    total: source.total,
  });
  return mapInvoiceTotals(raw);
}

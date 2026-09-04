/**
 * Invoice money math — client entry.
 *
 * **Point of truth (inputs):** `lineItems` + `invoiceDiscount` (%).
 * **Derivation:** only via `calculateInvoiceTotals` / `resolveInvoiceTotals`.
 * **Denormalized fields** on the invoice (`total`, `totalVat`, …) are a cache;
 * hydrate them with `withResolvedInvoiceTotals` so every view reads the same numbers.
 *
 * Server mirror: `plugins/invoices/invoiceTotals.js` (kept in parity by tests).
 */

import type { InvoiceLineItem } from '../types/invoices';

export type InvoiceTotals = {
  subtotal: number;
  totalDiscount: number;
  subtotalAfterDiscount: number;
  invoiceDiscountAmount: number;
  subtotalAfterInvoiceDiscount: number;
  totalVat: number;
  total: number;
};

export type InvoiceTotalsSource = {
  lineItems?: InvoiceLineItem[] | null;
  invoiceDiscount?: number | null;
  subtotal?: number | null;
  totalDiscount?: number | null;
  subtotalAfterDiscount?: number | null;
  invoiceDiscountAmount?: number | null;
  subtotalAfterInvoiceDiscount?: number | null;
  totalVat?: number | null;
  total?: number | null;
};

export function calculateInvoiceTotals(
  lineItems: InvoiceLineItem[],
  invoiceDiscount: number = 0,
): InvoiceTotals {
  let subtotal = 0;
  let totalDiscount = 0;

  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    return {
      subtotal: 0,
      totalDiscount: 0,
      subtotalAfterDiscount: 0,
      invoiceDiscountAmount: 0,
      subtotalAfterInvoiceDiscount: 0,
      totalVat: 0,
      total: 0,
    };
  }

  const pricedItems = lineItems.filter((item) => item && item.kind !== 'text');

  pricedItems.forEach((item) => {
    const lineSubtotal = item.lineSubtotal ?? (item.quantity || 0) * (item.unitPrice || 0);
    const discountAmount = item.discountAmount ?? lineSubtotal * ((item.discount || 0) / 100);
    subtotal += lineSubtotal;
    totalDiscount += discountAmount;
  });

  const subtotalAfterDiscount = subtotal - totalDiscount;
  const invoiceDiscountAmount = subtotalAfterDiscount * (Number(invoiceDiscount || 0) / 100);
  const subtotalAfterInvoiceDiscount = subtotalAfterDiscount - invoiceDiscountAmount;

  let totalVat = 0;
  pricedItems.forEach((item) => {
    const lineSubtotal = item.lineSubtotal ?? (item.quantity || 0) * (item.unitPrice || 0);
    const lineDiscountAmount = item.discountAmount ?? lineSubtotal * ((item.discount || 0) / 100);
    const lineAfterDiscount = lineSubtotal - lineDiscountAmount;
    if (subtotalAfterDiscount > 0) {
      const proportion = lineAfterDiscount / subtotalAfterDiscount;
      const finalLineAmount = subtotalAfterInvoiceDiscount * proportion;
      totalVat += finalLineAmount * ((item.vatRate ?? 25) / 100);
    }
  });

  const total = subtotalAfterInvoiceDiscount + totalVat;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    totalDiscount: Math.round(totalDiscount * 100) / 100,
    subtotalAfterDiscount: Math.round(subtotalAfterDiscount * 100) / 100,
    invoiceDiscountAmount: Math.round(invoiceDiscountAmount * 100) / 100,
    subtotalAfterInvoiceDiscount: Math.round(subtotalAfterInvoiceDiscount * 100) / 100,
    totalVat: Math.round(totalVat * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

/** Single entry for display: derive from lines + discount % when lines exist. */
export function resolveInvoiceTotals(source: InvoiceTotalsSource): InvoiceTotals {
  const lineItems = source?.lineItems || [];
  if (Array.isArray(lineItems) && lineItems.length > 0) {
    return calculateInvoiceTotals(lineItems, Number(source.invoiceDiscount || 0));
  }
  return {
    subtotal: Number(source?.subtotal || 0),
    totalDiscount: Number(source?.totalDiscount || 0),
    subtotalAfterDiscount: Number(source?.subtotalAfterDiscount || source?.subtotal || 0),
    invoiceDiscountAmount: Number(source?.invoiceDiscountAmount || 0),
    subtotalAfterInvoiceDiscount: Number(
      source?.subtotalAfterInvoiceDiscount ||
        source?.subtotalAfterDiscount ||
        source?.subtotal ||
        0,
    ),
    totalVat: Number(source?.totalVat || 0),
    total: Number(source?.total || 0),
  };
}

/** Stamp resolved totals onto an invoice so list / QC / full view / stats share one snapshot. */
export function withResolvedInvoiceTotals<T extends InvoiceTotalsSource>(
  invoice: T,
): T & InvoiceTotals {
  return { ...invoice, ...resolveInvoiceTotals(invoice) };
}

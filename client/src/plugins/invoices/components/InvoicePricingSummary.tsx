import React from 'react';
import { useTranslation } from 'react-i18next';

import type { InvoiceTotals } from '../utils/invoiceTotals';
import { buildInvoiceVatBreakdown } from '../utils/invoiceMlCompliance';
import { formatInvoiceMoney } from '../utils/formatInvoiceAmount';
import type { InvoiceLineItem } from '../types/invoices';

export function InvoicePricingSummary({
  totals,
  currency,
  invoiceDiscount = 0,
  lineItems,
  invoiceType,
}: {
  totals: InvoiceTotals;
  currency: string;
  invoiceDiscount?: number;
  lineItems?: InvoiceLineItem[] | null;
  invoiceType?: string | null;
}) {
  const { t } = useTranslation();
  const sign = String(invoiceType || '').trim() === 'credit_note' ? -1 : 1;
  const breakdown = buildInvoiceVatBreakdown(lineItems, invoiceDiscount).map((row) => ({
    ...row,
    taxBase: sign * Math.abs(row.taxBase),
    vatAmount: sign * Math.abs(row.vatAmount),
  }));

  return (
    <div className="space-y-2 text-sm">
      <div className="flex justify-between gap-3">
        <span className="text-muted-foreground">
          {t('invoices.subtotal', { defaultValue: 'Subtotal' })}
        </span>
        <span className="text-xs font-medium tabular-nums text-foreground">
          {formatInvoiceMoney(totals.subtotal, currency)}
        </span>
      </div>
      {totals.totalDiscount > 0 || totals.totalDiscount < 0 ? (
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">
            {t('invoices.lineDiscounts', { defaultValue: 'Line Discounts' })}
          </span>
          <span className="text-xs font-medium tabular-nums text-foreground">
            −{formatInvoiceMoney(Math.abs(totals.totalDiscount), currency)}
          </span>
        </div>
      ) : null}
      {totals.totalDiscount > 0 || totals.totalDiscount < 0 ? (
        <div className="flex justify-between gap-3 border-t border-border pt-2">
          <span className="text-muted-foreground">
            {t('invoices.subtotalAfterLineDiscounts', {
              defaultValue: 'Subtotal after line discounts',
            })}
          </span>
          <span className="text-xs font-medium tabular-nums text-foreground">
            {formatInvoiceMoney(totals.subtotalAfterDiscount, currency)}
          </span>
        </div>
      ) : null}
      {invoiceDiscount > 0 ? (
        <>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">
              {t('invoices.invoiceDiscount', { defaultValue: 'Invoice Discount' })} (
              {invoiceDiscount}%):
            </span>
            <span className="text-xs font-medium tabular-nums text-foreground">
              −{formatInvoiceMoney(Math.abs(totals.invoiceDiscountAmount), currency)}
            </span>
          </div>
          <div className="flex justify-between gap-3 border-t border-border pt-2">
            <span className="text-muted-foreground">
              {t('invoices.subtotalAfterInvoiceDiscount', {
                defaultValue: 'Subtotal after invoice discount',
              })}
            </span>
            <span className="text-xs font-medium tabular-nums text-foreground">
              {formatInvoiceMoney(totals.subtotalAfterInvoiceDiscount, currency)}
            </span>
          </div>
        </>
      ) : null}
      {breakdown.map((row) => (
        <div key={row.rate} className="flex justify-between gap-3">
          <span className="text-muted-foreground">
            {t('invoices.vatOnRate', {
              rate: row.rate,
              base: formatInvoiceMoney(row.taxBase, currency),
              defaultValue: 'VAT {{rate}}% on {{base}}',
            })}
          </span>
          <span className="text-xs font-medium tabular-nums text-foreground">
            {formatInvoiceMoney(row.vatAmount, currency)}
          </span>
        </div>
      ))}
      <div className="flex justify-between gap-3">
        <span className="text-muted-foreground">
          {t('invoices.totalVat', { defaultValue: 'Total VAT' })}
        </span>
        <span className="text-xs font-medium tabular-nums text-foreground">
          {formatInvoiceMoney(totals.totalVat, currency)}
        </span>
      </div>
      <div className="flex justify-between gap-3 border-t border-border pt-2 text-lg font-semibold">
        <span className="text-foreground">
          {t('invoices.totalAmount', { defaultValue: 'Total' })}
        </span>
        <span className="tabular-nums text-foreground">
          {formatInvoiceMoney(totals.total, currency)}
        </span>
      </div>
    </div>
  );
}

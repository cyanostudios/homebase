import React from 'react';
import { useTranslation } from 'react-i18next';

import { formatInvoiceMoney } from '@/plugins/invoices/utils/formatInvoiceAmount';

import type { EstimateTotals } from '../utils/estimateTotals';

export function EstimatePricingSummary({
  totals,
  currency,
  estimateDiscount = 0,
}: {
  totals: EstimateTotals;
  currency: string;
  estimateDiscount?: number;
}) {
  const { t } = useTranslation();

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
      {totals.totalDiscount > 0 ? (
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">
            {t('invoices.lineDiscounts', { defaultValue: 'Line Discounts' })}
          </span>
          <span className="text-xs font-medium tabular-nums text-foreground">
            −{formatInvoiceMoney(totals.totalDiscount, currency)}
          </span>
        </div>
      ) : null}
      {totals.totalDiscount > 0 ? (
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
      {estimateDiscount > 0 ? (
        <>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">
              {t('estimates.discount')} ({estimateDiscount}%):
            </span>
            <span className="text-xs font-medium tabular-nums text-foreground">
              −{formatInvoiceMoney(totals.estimateDiscountAmount, currency)}
            </span>
          </div>
          <div className="flex justify-between gap-3 border-t border-border pt-2">
            <span className="text-muted-foreground">
              {t('estimates.subtotalAfterEstimateDiscount', {
                defaultValue: 'Subtotal after estimate discount',
              })}
            </span>
            <span className="text-xs font-medium tabular-nums text-foreground">
              {formatInvoiceMoney(totals.subtotalAfterEstimateDiscount, currency)}
            </span>
          </div>
        </>
      ) : null}
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

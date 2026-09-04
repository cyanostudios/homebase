import { Calculator, Calendar, CreditCard, Hash, ListOrdered, Receipt, Wallet } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  DETAIL_FIELD_VALUE_CLASS,
  DETAIL_NOTE_CALLOUT_CLASS,
  DETAIL_VIEW_CARD_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { BADGE_CHIP_CLASS, QC_INVOICE_STATUS_BADGE_COLORS } from '@/core/ui/badgeStyles';
import { SubtleSectionHeading } from '@/core/ui/DetailSection';
import { QuickContextActiveShareLink } from '@/core/ui/QuickContextActiveShareLink';
import {
  QuickContextHeaderActions,
  QuickContextOpenFullFooter,
} from '@/core/ui/QuickContextHeaderActions';
import { PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { formatDate, formatDateTimeShort } from '@/core/utils/dateFormat';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { cn } from '@/lib/utils';

import { invoicesApi } from '../api/invoicesApi';
import type { Invoice, InvoiceShare } from '../context/InvoicesContext';
import { formatInvoiceAmount, formatInvoiceMoney } from '../utils/formatInvoiceAmount';
import { resolveInvoiceTotals } from '../utils/invoiceTotals';
import { displayPlainText } from '../utils/htmlText';
import { formatInvoiceDueDate, formatPaymentTermsLabel } from '../utils/invoiceDueDate';

import { InvoicePricingSummary } from './InvoicePricingSummary';
import { formatInvoiceStatusForDisplay } from './InvoiceStatusSelect';
const FACT_LABEL_CLASS =
  'mb-0.5 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400';

function invoiceInitials(invoice: Invoice): string {
  const raw = String(invoice.invoiceNumber || invoice.id || '').trim();
  const digits = raw.replace(/\D/g, '');
  if (digits.length > 0) {
    return digits.slice(-2);
  }
  return raw.slice(0, 2).toUpperCase() || '—';
}

export function InvoiceQuickContextPanel({
  invoice,
  onClose,
  onOpenFullProfile,
  onEdit,
  variant = 'list',
  children,
}: {
  invoice: Invoice;
  onClose?: () => void;
  onOpenFullProfile?: () => void;
  onEdit: () => void;
  /** `list` = small preview beside the list; `full` = first column in full detail view. */
  variant?: 'list' | 'full';
  /** Extra content below the fact grid (full view: line items, pricing, notes). */
  children?: React.ReactNode;
}) {
  const isFullView = variant === 'full';
  const { t } = useTranslation();
  const [listShareUrl, setListShareUrl] = useState<string | null>(null);
  const status = invoice.status || 'draft';
  const due = formatInvoiceDueDate(invoice.dueDate);
  const showDueUrgency = status !== 'paid' && status !== 'canceled';
  const numberLabel = formatDisplayNumber('invoices', invoice.invoiceNumber || invoice.id);
  const issueDateLabel = formatDate(invoice.issueDate) || '—';
  const dueDateLabel = formatDate(invoice.dueDate) || '—';
  const currency = invoice.currency || 'SEK';
  const paymentTermsLabel = formatPaymentTermsLabel(invoice.paymentTerms);
  const lineItemCount = Array.isArray(invoice.lineItems) ? invoice.lineItems.length : 0;
  const invoiceNotes = displayPlainText(invoice.notes).trim();
  const amountPaid = Number(invoice.amountPaid || 0);
  const invoiceDiscount = Number(invoice.invoiceDiscount || 0);
  const totals = resolveInvoiceTotals(invoice);
  const totalAmount = totals.total;
  const amountLabel = formatInvoiceAmount(totalAmount);
  const remaining = Math.max(0, Math.round((totalAmount - amountPaid) * 100) / 100);
  const hasPayments = amountPaid > 0;
  const updatedLabel = invoice.updatedAt ? formatDateTimeShort(invoice.updatedAt) : null;

  useEffect(() => {
    if (isFullView) {
      setListShareUrl(null);
      return;
    }
    let cancelled = false;
    setListShareUrl(null);
    invoicesApi
      .getShares(invoice.id)
      .then((shares: InvoiceShare[]) => {
        if (cancelled) {
          return;
        }
        const active = shares.find((share) => new Date(share.validUntil) > new Date());
        setListShareUrl(
          active ? `${window.location.origin}/public/invoice/${active.shareToken}` : null,
        );
      })
      .catch(() => {
        if (!cancelled) {
          setListShareUrl(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isFullView, invoice.id]);

  const identityHeader = (
    <div className="flex items-center gap-3">
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold plugin-invoices bg-plugin-subtle text-plugin"
        aria-hidden
      >
        {invoiceInitials(invoice)}
      </div>
      <h3 className={cn(PLUGIN_PAGE_TITLE_CLASS, 'min-w-0 flex-1')}>
        {invoice.contactName || t('invoices.noCustomer')}
      </h3>
      <QuickContextHeaderActions
        onOpen={!isFullView && onOpenFullProfile ? onOpenFullProfile : undefined}
        onEdit={onEdit}
        onClose={!isFullView && onClose ? onClose : undefined}
        editLabel={t('common.edit')}
        closeLabel={t('common.close')}
      />
    </div>
  );

  const factValueClass = 'text-base font-medium text-foreground';
  const factValueEmphasisClass = DETAIL_FIELD_VALUE_CLASS;

  const factGrid = (
    <div className="grid grid-cols-1 gap-y-3 md:grid-cols-2 md:gap-x-4">
      <div>
        <div className={FACT_LABEL_CLASS}>
          <Hash className="h-3 w-3" />
          {t('invoices.table.number')}
        </div>
        <div className={factValueClass}>{numberLabel || '—'}</div>
      </div>
      <div>
        <div className={FACT_LABEL_CLASS}>
          <Calendar className="h-3 w-3" />
          {t('invoices.issueDate')}
        </div>
        <div className={factValueClass}>{issueDateLabel}</div>
      </div>
      <div>
        <div className={FACT_LABEL_CLASS}>
          <Calendar className="h-3 w-3" />
          {t('invoices.fieldDueDate')}
        </div>
        <div
          className={cn(factValueEmphasisClass, showDueUrgency && due ? due.className : undefined)}
        >
          {due && showDueUrgency ? due.text : dueDateLabel}
        </div>
      </div>
      <div>
        <div className={FACT_LABEL_CLASS}>
          <Wallet className="h-3 w-3" />
          {t('invoices.table.total')}
        </div>
        <div className={cn(factValueEmphasisClass, 'tabular-nums')}>
          {amountLabel} {currency}
        </div>
      </div>
      <div>
        <div className={FACT_LABEL_CLASS}>
          <Receipt className="h-3 w-3" />
          {t('invoices.currency')}
        </div>
        <div className={factValueClass}>{currency}</div>
      </div>
      <div>
        <div className={FACT_LABEL_CLASS}>{t('invoices.paymentTerms')}</div>
        <div className={cn(factValueClass, 'truncate')}>{paymentTermsLabel}</div>
      </div>
      {!isFullView ? (
        <div>
          <div className={FACT_LABEL_CLASS}>
            <ListOrdered className="h-3 w-3" />
            {t('invoices.quickInfo.items')}
          </div>
          <div className={factValueClass}>
            {t('invoices.quickInfo.itemsCount', { count: lineItemCount })}
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <Card
      padding="none"
      className={cn(DETAIL_VIEW_CARD_CLASS, 'plugin-invoices flex flex-col')}
      data-plugin-name="invoices"
    >
      <div className="border-b border-border/50 px-4 py-5">{identityHeader}</div>

      <div className={cn('px-4 py-4', isFullView ? 'space-y-4' : 'space-y-6')}>
        <div className="flex flex-wrap items-center gap-2">
          {updatedLabel ? (
            <p className="min-w-0 flex-1 text-xs text-muted-foreground">
              {t('common.updated')} {updatedLabel}
            </p>
          ) : (
            <div className="min-w-0 flex-1" />
          )}
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            <Badge
              className={cn(
                'shrink-0',
                BADGE_CHIP_CLASS,
                QC_INVOICE_STATUS_BADGE_COLORS[status] ?? QC_INVOICE_STATUS_BADGE_COLORS.draft,
              )}
            >
              {formatInvoiceStatusForDisplay(status)}
            </Badge>
          </div>
        </div>

        {factGrid}

        {!isFullView && invoiceNotes ? (
          <div>
            <div className="mb-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                {t('invoices.notesAndTerms')}
              </span>
            </div>
            <div className={DETAIL_NOTE_CALLOUT_CLASS}>
              <p className="whitespace-pre-wrap text-sm font-medium text-amber-950 dark:text-amber-200">
                {invoiceNotes}
              </p>
            </div>
          </div>
        ) : null}

        {!isFullView && lineItemCount > 0 ? (
          <div className="space-y-2">
            <SubtleSectionHeading title={t('invoices.pricingSummary')} icon={Calculator} />
            <InvoicePricingSummary
              totals={totals}
              currency={currency}
              invoiceDiscount={invoiceDiscount}
            />
          </div>
        ) : null}

        {!isFullView && hasPayments ? (
          <div className="space-y-2">
            <SubtleSectionHeading
              title={t('invoices.payments.title', { defaultValue: 'Payments' })}
              icon={CreditCard}
            />
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">
                  {t('invoices.payments.paid', { defaultValue: 'Paid' })}
                </span>
                <span className="text-xs font-medium tabular-nums text-foreground">
                  {formatInvoiceMoney(amountPaid, currency)}
                </span>
              </div>
              {remaining > 0 ? (
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">
                    {t('invoices.payments.remaining', { defaultValue: 'Remaining' })}
                  </span>
                  <span className="text-xs font-medium tabular-nums text-foreground">
                    {formatInvoiceMoney(remaining, currency)}
                  </span>
                </div>
              ) : (
                <p className="text-sm font-medium text-green-700 dark:text-green-400">
                  {t('invoices.payments.fullyPaidHint', {
                    defaultValue: 'This invoice is fully paid.',
                  })}
                </p>
              )}
            </div>
          </div>
        ) : null}

        {isFullView && children ? (
          <div className="min-w-0 space-y-6 overflow-x-hidden border-t border-border/50 pt-4">
            {children}
          </div>
        ) : null}
      </div>

      {!isFullView && listShareUrl ? (
        <div className="px-4 pb-4">
          <QuickContextActiveShareLink
            shareUrl={listShareUrl}
            activeLabel={t('invoices.shareActive')}
          />
        </div>
      ) : null}

      {!isFullView && onOpenFullProfile ? (
        <QuickContextOpenFullFooter onOpen={onOpenFullProfile} />
      ) : null}
    </Card>
  );
}

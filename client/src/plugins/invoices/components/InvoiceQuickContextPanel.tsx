import { Calendar, Hash, ListOrdered, Receipt, Wallet } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  DETAIL_FIELD_VALUE_CLASS,
  DETAIL_NOTE_CALLOUT_CLASS,
  DETAIL_VIEW_CARD_CLASS,
} from '@/core/ui/detailViewCardStyles';
import {
  QuickContextHeaderActions,
  QuickContextOpenFullFooter,
} from '@/core/ui/QuickContextHeaderActions';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { cn } from '@/lib/utils';

import type { Invoice } from '../context/InvoicesContext';
import { formatInvoiceDueDate, formatPaymentTermsLabel } from '../utils/invoiceDueDate';

import {
  INVOICE_STATUS_BADGE_CLASS,
  INVOICE_STATUS_COLORS,
  formatInvoiceStatusForDisplay,
} from './InvoiceStatusSelect';

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
  const { t, i18n } = useTranslation();
  const status = invoice.status || 'draft';
  const due = formatInvoiceDueDate(invoice.dueDate);
  const showDueUrgency = status !== 'paid' && status !== 'canceled';
  const numberLabel = formatDisplayNumber('invoices', invoice.invoiceNumber || invoice.id);
  const issueDate = invoice.issueDate ? new Date(invoice.issueDate) : null;
  const amountLabel =
    typeof invoice.total === 'number'
      ? invoice.total.toFixed(2)
      : invoice.total !== null && invoice.total !== undefined
        ? String(invoice.total)
        : '—';
  const currency = invoice.currency || 'SEK';
  const paymentTermsLabel = formatPaymentTermsLabel(invoice.paymentTerms);
  const lineItemCount = Array.isArray(invoice.lineItems) ? invoice.lineItems.length : 0;
  const invoiceNotes = invoice.notes?.trim() || '';

  const identityHeader = (
    <div className="flex items-start gap-3">
      <div
        className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold plugin-invoices bg-plugin-subtle text-plugin"
        aria-hidden
      >
        {invoiceInitials(invoice)}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="break-words text-base font-semibold leading-snug tracking-tight text-foreground sm:text-lg">
          {invoice.contactName || t('invoices.noCustomer')}
        </h3>
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Badge
              className={cn(
                'shrink-0',
                INVOICE_STATUS_BADGE_CLASS,
                INVOICE_STATUS_COLORS[status] || INVOICE_STATUS_COLORS.draft,
              )}
            >
              {formatInvoiceStatusForDisplay(status)}
            </Badge>
          </div>
          <QuickContextHeaderActions
            onOpen={!isFullView && onOpenFullProfile ? onOpenFullProfile : undefined}
            onEdit={onEdit}
            onClose={!isFullView && onClose ? onClose : undefined}
            editLabel={t('common.edit')}
            closeLabel={t('common.close')}
          />
        </div>
      </div>
    </div>
  );

  const factGrid = (
    <div className="grid grid-cols-1 gap-y-3 md:grid-cols-2 md:gap-x-4">
      <div>
        <div className={FACT_LABEL_CLASS}>
          <Hash className="h-3 w-3" />
          {t('invoices.table.number')}
        </div>
        <div className={DETAIL_FIELD_VALUE_CLASS}>{numberLabel || '—'}</div>
      </div>
      <div>
        <div className={FACT_LABEL_CLASS}>
          <Calendar className="h-3 w-3" />
          {t('invoices.issueDate')}
        </div>
        <div className={DETAIL_FIELD_VALUE_CLASS}>
          {issueDate ? issueDate.toLocaleDateString(i18n.language) : '—'}
        </div>
      </div>
      <div>
        <div className={FACT_LABEL_CLASS}>
          <Calendar className="h-3 w-3" />
          {t('invoices.fieldDueDate')}
        </div>
        <div
          className={cn(
            DETAIL_FIELD_VALUE_CLASS,
            showDueUrgency && due ? due.className : undefined,
          )}
        >
          {due && showDueUrgency
            ? due.text
            : invoice.dueDate
              ? new Date(invoice.dueDate).toLocaleDateString(i18n.language)
              : '—'}
        </div>
      </div>
      <div>
        <div className={FACT_LABEL_CLASS}>
          <Wallet className="h-3 w-3" />
          {t('invoices.table.total')}
        </div>
        <div className={cn(DETAIL_FIELD_VALUE_CLASS, 'tabular-nums')}>
          {amountLabel} {currency}
        </div>
      </div>
      <div>
        <div className={FACT_LABEL_CLASS}>
          <Receipt className="h-3 w-3" />
          {t('invoices.currency')}
        </div>
        <div className={DETAIL_FIELD_VALUE_CLASS}>{currency}</div>
      </div>
      <div>
        <div className={FACT_LABEL_CLASS}>{t('invoices.paymentTerms')}</div>
        <div className={cn(DETAIL_FIELD_VALUE_CLASS, 'truncate')}>{paymentTermsLabel}</div>
      </div>
      {!isFullView ? (
        <div>
          <div className={FACT_LABEL_CLASS}>
            <ListOrdered className="h-3 w-3" />
            {t('invoices.quickInfo.items')}
          </div>
          <div className={DETAIL_FIELD_VALUE_CLASS}>
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
      <div className="border-b border-border/50 px-4 py-3">{identityHeader}</div>

      <div className={cn('px-4 py-4', isFullView ? 'space-y-4' : 'space-y-6')}>
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

        {isFullView && children ? (
          <div className="min-w-0 space-y-6 overflow-x-hidden border-t border-border/50 pt-4">
            {children}
          </div>
        ) : null}
      </div>

      {!isFullView && onOpenFullProfile ? (
        <QuickContextOpenFullFooter onOpen={onOpenFullProfile} />
      ) : null}
    </Card>
  );
}

import { Calendar, FileText, Hash, Receipt, User, Users, Wallet } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useApp } from '@/core/api/AppContext';
import {
  DETAIL_HEADER_BELOW_MENUS_CLASS,
  DETAIL_HEADER_CHIP_GAP_CLASS,
} from '@/core/ui/DetailHeaderMenus';
import { DETAIL_FIELD_VALUE_CLASS, DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { SectionCategoryIcon } from '@/core/ui/DetailSection';
import { PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { formatDate, formatDateTimeShort } from '@/core/utils/dateFormat';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { cn } from '@/lib/utils';
import { CONTACT_TYPE_ICON_SHELL_CLASS } from '@/plugins/contacts/types/contacts';

import type { Invoice } from '../context/InvoicesContext';
import { formatInvoiceAmount, formatInvoiceMoney } from '../utils/formatInvoiceAmount';
import { formatInvoiceDueDate, formatPaymentTermsLabel } from '../utils/invoiceDueDate';
import { resolveInvoiceTotals } from '../utils/invoiceTotals';

import { InvoiceDetailHeaderMenus } from './InvoiceDetailHeaderMenus';
import {
  INVOICE_STATUS_BADGE_CLASS,
  INVOICE_STATUS_COLORS,
  formatInvoiceStatusForDisplay,
} from './InvoiceStatusSelect';

const FACT_LABEL_CLASS =
  'mb-0.5 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400';

export function InvoiceQuickContextPanel({
  invoice,
  headerBelow = null,
  children,
}: {
  invoice: Invoice;
  headerBelow?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const { contacts } = useApp();
  const status = invoice.status || 'draft';
  const invoiceType = invoice.invoiceType || 'invoice';
  const due = formatInvoiceDueDate(invoice.dueDate);
  const showDueUrgency = status !== 'paid' && status !== 'canceled';
  const numberLabel = formatDisplayNumber('invoices', invoice.invoiceNumber || invoice.id);
  const typeLabel = t(`invoices.type.${invoiceType}`, { defaultValue: invoiceType });
  const issueDateLabel = formatDate(invoice.issueDate) || '—';
  const dueDateLabel = formatDate(invoice.dueDate) || '—';
  const currency = invoice.currency || 'SEK';
  const paymentTermsLabel = formatPaymentTermsLabel(invoice.paymentTerms);
  const totals = resolveInvoiceTotals(invoice);
  const amountLabel = formatInvoiceAmount(totals.total);
  const totalLabel = formatInvoiceMoney(totals.total, currency);
  const contactName = invoice.contactName?.trim() || '';
  const updatedLabel = invoice.updatedAt ? formatDateTimeShort(invoice.updatedAt) : null;

  const contactType = (() => {
    if (invoice.contactId == null) {
      return undefined;
    }
    const contact = contacts?.find((c) => String(c.id) === String(invoice.contactId));
    if (!contact?.contactType) {
      return undefined;
    }
    return contact.contactType === 'private' ? 'private' : 'company';
  })();
  const ContactTypeIcon =
    contactType === 'private' ? User : contactType === 'company' ? Users : null;
  const contactTypeLabel = contactType
    ? t(`contacts.type.${contactType}`, {
        defaultValue: contactType === 'private' ? 'Private' : 'Company',
      })
    : null;

  const titleLeading = (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <h3 className={cn(PLUGIN_PAGE_TITLE_CLASS, 'min-w-0 font-mono')}>{numberLabel}</h3>
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
      <div className="flex min-w-0 items-center gap-1.5">
        {ContactTypeIcon ? (
          <span title={contactTypeLabel ?? undefined} className="inline-flex shrink-0">
            <SectionCategoryIcon
              icon={ContactTypeIcon}
              className={contactType ? CONTACT_TYPE_ICON_SHELL_CLASS[contactType] : undefined}
            />
          </span>
        ) : null}
        <span className="min-w-0 truncate text-sm font-normal leading-tight text-slate-400 dark:text-slate-500">
          {contactName || t('invoices.noCustomer')}
        </span>
        {totalLabel ? (
          <span className="shrink-0 tabular-nums text-sm font-normal leading-tight text-slate-400 dark:text-slate-500">
            {totalLabel}
          </span>
        ) : null}
      </div>
    </div>
  );

  const factValueClass = 'text-base font-medium text-foreground';
  const factValueEmphasisClass = DETAIL_FIELD_VALUE_CLASS;

  return (
    <Card
      padding="none"
      className={cn(DETAIL_VIEW_CARD_CLASS, 'plugin-invoices flex flex-col')}
      data-plugin-name="invoices"
    >
      <div className="border-b border-border/50 px-4 py-5">
        <InvoiceDetailHeaderMenus invoice={invoice} leading={titleLeading} />
        {updatedLabel ? (
          <div
            className={cn(
              DETAIL_HEADER_BELOW_MENUS_CLASS,
              'flex min-w-0 flex-wrap items-center',
              DETAIL_HEADER_CHIP_GAP_CLASS,
            )}
          >
            <p className="min-w-0 text-xs text-muted-foreground">
              {t('common.updated')} {updatedLabel}
            </p>
          </div>
        ) : null}
        {headerBelow ? <div className="mt-4">{headerBelow}</div> : null}
      </div>

      <div className="space-y-4 px-4 py-4">
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
              <FileText className="h-3 w-3" />
              {t('invoices.invoiceType', { defaultValue: 'Invoice type' })}
            </div>
            <div className={factValueClass}>{typeLabel}</div>
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
              className={cn(
                factValueEmphasisClass,
                showDueUrgency && due ? due.className : undefined,
              )}
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
        </div>

        {children ? (
          <div className="min-w-0 space-y-6 overflow-x-hidden border-t border-border/50 pt-4">
            {children}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

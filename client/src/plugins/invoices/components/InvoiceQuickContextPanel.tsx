import { User, Users } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useApp } from '@/core/api/AppContext';
import {
  DETAIL_HEADER_BELOW_MENUS_CLASS,
  DETAIL_HEADER_CHIP_GAP_CLASS,
} from '@/core/ui/DetailHeaderMenus';
import { DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { SectionCategoryIcon } from '@/core/ui/DetailSection';
import { PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { formatDateTimeShort } from '@/core/utils/dateFormat';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { cn } from '@/lib/utils';
import { CONTACT_TYPE_ICON_SHELL_CLASS } from '@/plugins/contacts/types/contacts';

import type { Invoice } from '../context/InvoicesContext';
import { formatInvoiceMoney } from '../utils/formatInvoiceAmount';
import { resolveInvoiceTotals } from '../utils/invoiceTotals';

import { InvoiceDetailHeaderMenus } from './InvoiceDetailHeaderMenus';
import {
  INVOICE_STATUS_BADGE_CLASS,
  INVOICE_STATUS_COLORS,
  formatInvoiceStatusForDisplay,
} from './InvoiceStatusSelect';

/**
 * Contacts-class header card only (title + menus + optional tab chips).
 * Invoice facts live on the Information tab in InvoicesView — not here.
 */
export function InvoiceQuickContextPanel({
  invoice,
  headerBelow = null,
}: {
  invoice: Invoice;
  headerBelow?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const { contacts } = useApp();
  const status = invoice.status || 'draft';
  const numberLabel = formatDisplayNumber('invoices', invoice.invoiceNumber || invoice.id);
  const currency = invoice.currency || 'SEK';
  const totals = resolveInvoiceTotals(invoice);
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

  return (
    <Card
      padding="none"
      className={cn(DETAIL_VIEW_CARD_CLASS, 'plugin-invoices flex flex-col')}
      data-plugin-name="invoices"
    >
      <div className="px-4 py-5">
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
    </Card>
  );
}

import { CalendarDays } from 'lucide-react';
import React from 'react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  DETAIL_VIEW_CARD_CLASS,
  DETAIL_LIST_ITEM_HOVER_CLASS,
  DETAIL_LIST_ITEM_TITLE_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { ListSelectionCheckboxSlot } from '@/core/ui/ListSelectionCheckboxSlot';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { cn } from '@/lib/utils';

import type { Invoice } from '../context/InvoicesContext';
import type { InvoiceColumnCount } from '../utils/invoiceColumnCount';
import { formatInvoiceDueDate } from '../utils/invoiceDueDate';

import {
  INVOICE_STATUS_BADGE_CLASS,
  INVOICE_STATUS_COLORS,
  formatInvoiceStatusForDisplay,
} from './InvoiceStatusSelect';

export function InvoiceListItem({
  invoice,
  selected,
  highlighted,
  active,
  onClick,
  checkbox,
  columnCount = 1,
}: {
  invoice: Invoice;
  selected?: boolean;
  highlighted?: boolean;
  active?: boolean;
  onClick: () => void;
  checkbox?: React.ReactNode;
  columnCount?: InvoiceColumnCount;
}) {
  const status = invoice.status || 'draft';
  const due = formatInvoiceDueDate(invoice.dueDate);
  const showDueUrgency = status !== 'paid' && status !== 'canceled';
  const metaOnTop = columnCount === 1;
  const itemCount = invoice.lineItems?.length ?? 0;

  const metaRow = (
    <div
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground',
        !metaOnTop && 'mt-0.5 pt-0.5',
      )}
    >
      <span className="font-medium text-foreground">
        {typeof invoice.total === 'number' ? invoice.total.toFixed(2) : invoice.total}{' '}
        {invoice.currency || 'SEK'}
      </span>
      <span>
        {itemCount} item{itemCount !== 1 ? 's' : ''}
      </span>
      {due && showDueUrgency ? (
        <span className={cn('inline-flex min-w-0 items-center gap-1.5', due.className)}>
          <CalendarDays className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate">{due.text}</span>
        </span>
      ) : invoice.dueDate ? (
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate">{new Date(invoice.dueDate).toLocaleDateString()}</span>
        </span>
      ) : null}
    </div>
  );

  const openOnKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <Card
      className={cn(
        'group cursor-pointer overflow-hidden p-0 transition-all',
        DETAIL_VIEW_CARD_CLASS,
        highlighted && 'bg-green-50 dark:bg-green-950/30',
        active && 'bg-primary/5 ring-1 ring-primary/40',
        selected ? 'bg-plugin-subtle ring-1 border-plugin-subtle' : DETAIL_LIST_ITEM_HOVER_CLASS,
      )}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('input[type="checkbox"], button')) {
          return;
        }
        onClick();
      }}
      onKeyDown={openOnKeyDown}
      data-list-item={JSON.stringify(invoice)}
      data-plugin-name="invoices"
      role="button"
      tabIndex={0}
      aria-current={active ? 'true' : undefined}
      aria-label={`Open invoice ${formatDisplayNumber('invoices', invoice.invoiceNumber || invoice.id)}`}
    >
      <div className="flex flex-col gap-2 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <ListSelectionCheckboxSlot>{checkbox}</ListSelectionCheckboxSlot>
            <span className="font-mono text-[10px] text-muted-foreground">
              {formatDisplayNumber('invoices', invoice.invoiceNumber || invoice.id)}
            </span>
            <Badge
              className={cn(
                INVOICE_STATUS_BADGE_CLASS,
                INVOICE_STATUS_COLORS[status] || INVOICE_STATUS_COLORS.draft,
              )}
            >
              {formatInvoiceStatusForDisplay(status)}
            </Badge>
            {due && showDueUrgency && status === 'sent' ? (
              <Badge className={due.badgeClassName}>{due.text}</Badge>
            ) : null}
            {metaOnTop ? metaRow : null}
          </div>
        </div>

        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <h3 className={cn('line-clamp-1 min-w-0', DETAIL_LIST_ITEM_TITLE_CLASS)}>
            {invoice.contactName || 'No customer'}
          </h3>
          {invoice.organizationNumber ? (
            <span className="truncate text-xs text-muted-foreground">
              Org: {invoice.organizationNumber}
            </span>
          ) : null}
        </div>

        {!metaOnTop ? metaRow : null}
      </div>
    </Card>
  );
}

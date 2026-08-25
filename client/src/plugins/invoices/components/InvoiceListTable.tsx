import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { SortableListTable, type SortableListTableColumn } from '@/core/ui/SortableListTable';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { cn } from '@/lib/utils';

import type { Invoice } from '../context/InvoicesContext';
import { formatInvoiceDueDate } from '../utils/invoiceDueDate';
import type { InvoiceSortField, InvoiceSortOrder } from '../utils/invoiceListSort';

import {
  INVOICE_STATUS_BADGE_CLASS,
  INVOICE_STATUS_COLORS,
  formatInvoiceStatusForDisplay,
} from './InvoiceStatusSelect';

export type InvoiceListTableProps = {
  invoices: Invoice[];
  primarySort: InvoiceSortField;
  sortOrder: InvoiceSortOrder;
  onSort: (field: InvoiceSortField) => void;
  isSelected: (id: string) => boolean;
  onRowClick: (invoice: Invoice) => void;
  onCheckboxMouseDown: (event: React.MouseEvent, index: number) => void;
  onCheckboxChange: (id: string) => void;
  allVisibleSelected: boolean;
  onHeaderCheckboxChange: () => void;
  recentlyDuplicatedInvoiceId?: string | null;
  activeInvoiceId?: string | number | null;
};

function formatDate(value: Date | string | null | undefined): string {
  if (!value) {
    return '—';
  }
  return new Date(value).toLocaleDateString();
}

export function InvoiceListTable({
  invoices,
  primarySort,
  sortOrder,
  onSort,
  isSelected,
  onRowClick,
  onCheckboxMouseDown,
  onCheckboxChange,
  allVisibleSelected,
  onHeaderCheckboxChange,
  recentlyDuplicatedInvoiceId = null,
  activeInvoiceId = null,
}: InvoiceListTableProps) {
  const { t } = useTranslation();

  const columns = useMemo<SortableListTableColumn<Invoice, InvoiceSortField>[]>(
    () => [
      {
        field: 'invoiceNumber',
        header: t('invoices.table.number', { defaultValue: 'Number' }),
        cell: (invoice) => (
          <span className="font-mono text-xs font-medium text-foreground">
            {formatDisplayNumber('invoices', invoice.invoiceNumber || invoice.id)}
          </span>
        ),
      },
      {
        field: 'contactName',
        header: t('invoices.fieldContact', { defaultValue: 'Customer' }),
        cell: (invoice) => (
          <span className="font-medium text-foreground">{invoice.contactName || '—'}</span>
        ),
      },
      {
        field: 'status',
        header: t('invoices.fieldStatus', { defaultValue: 'Status' }),
        cell: (invoice) => {
          const status = invoice.status || 'draft';
          return (
            <Badge
              className={cn(
                INVOICE_STATUS_BADGE_CLASS,
                INVOICE_STATUS_COLORS[status] || INVOICE_STATUS_COLORS.draft,
              )}
            >
              {formatInvoiceStatusForDisplay(status)}
            </Badge>
          );
        },
      },
      {
        field: 'total',
        header: t('invoices.table.total', { defaultValue: 'Total' }),
        className: 'hidden sm:table-cell',
        cell: (invoice) => (
          <span className="tabular-nums text-xs text-foreground">
            {typeof invoice.total === 'number' ? invoice.total.toFixed(2) : invoice.total}{' '}
            {invoice.currency || 'SEK'}
          </span>
        ),
      },
      {
        field: 'dueDate',
        header: t('invoices.fieldDueDate', { defaultValue: 'Due' }),
        className: 'hidden md:table-cell',
        cell: (invoice) => {
          const due = formatInvoiceDueDate(invoice.dueDate);
          const showUrgency = invoice.status !== 'paid' && invoice.status !== 'canceled';
          if (due && showUrgency) {
            return <span className={cn('text-xs', due.className)}>{due.text}</span>;
          }
          return (
            <span className="text-xs text-muted-foreground">{formatDate(invoice.dueDate)}</span>
          );
        },
      },
      {
        field: 'updatedAt',
        header: t('common.updated', { defaultValue: 'Updated' }),
        className: 'hidden lg:table-cell',
        cell: (invoice) => (
          <span className="text-xs text-muted-foreground">{formatDate(invoice.updatedAt)}</span>
        ),
      },
    ],
    [t],
  );

  return (
    <SortableListTable
      rows={invoices}
      columns={columns}
      getRowId={(invoice) => String(invoice.id)}
      primarySort={primarySort}
      sortOrder={sortOrder}
      onSort={onSort}
      onRowClick={onRowClick}
      rowAriaLabel={(invoice) =>
        `Open invoice ${formatDisplayNumber('invoices', invoice.invoiceNumber || invoice.id)}`
      }
      rowClassName={(invoice) =>
        recentlyDuplicatedInvoiceId === String(invoice.id)
          ? 'bg-green-50 dark:bg-green-950/30'
          : undefined
      }
      isRowActive={(invoice) =>
        activeInvoiceId !== null &&
        activeInvoiceId !== undefined &&
        String(invoice.id) === String(activeInvoiceId)
      }
      selection={{
        isSelected,
        onCheckboxMouseDown,
        onCheckboxChange,
        allVisibleSelected,
        onHeaderCheckboxChange,
        selectAllAriaLabel: t('common.selectAllVisible'),
        selectRowAriaLabel: (selected) =>
          selected ? t('common.unselectRow') : t('common.selectRow'),
      }}
      pluginName="invoices"
      dataListItem={(invoice) => invoice}
    />
  );
}

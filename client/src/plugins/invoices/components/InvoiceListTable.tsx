import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { User, Users } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { useApp } from '@/core/api/AppContext';
import { SectionCategoryIcon } from '@/core/ui/DetailSection';
import { SortableListTable, type SortableListTableColumn } from '@/core/ui/SortableListTable';
import { formatDate, formatDateTimeShort } from '@/core/utils/dateFormat';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { cn } from '@/lib/utils';
import { CONTACT_TYPE_ICON_SHELL_CLASS } from '@/plugins/contacts/types/contacts';

import type { Invoice } from '../context/InvoicesContext';
import { formatInvoiceMoney } from '../utils/formatInvoiceAmount';
import { formatInvoiceDueDate } from '../utils/invoiceDueDate';
import type { InvoiceSortField, InvoiceSortOrder } from '../utils/invoiceListSort';
import {
  DEFAULT_INVOICE_TABLE_COLUMNS,
  type InvoiceTableColumnId,
  resolveVisibleInvoiceTableColumns,
} from '../utils/invoiceTableColumns';
import { resolveInvoiceTotals } from '../utils/invoiceTotals';

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
  selectionEnabled?: boolean;
  visibleColumnIds?: InvoiceTableColumnId[];
};

function formatInvoiceListDate(value: Date | string | null | undefined): string {
  return formatDate(value) || '—';
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
  selectionEnabled = true,
  visibleColumnIds,
}: InvoiceListTableProps) {
  const { t } = useTranslation();
  const { contacts } = useApp();

  const contactTypeById = useMemo(() => {
    const map = new Map<string, 'company' | 'private'>();
    for (const contact of contacts ?? []) {
      if (contact?.id == null || !contact.contactType) {
        continue;
      }
      map.set(String(contact.id), contact.contactType === 'private' ? 'private' : 'company');
    }
    return map;
  }, [contacts]);

  const orderedVisibleIds = useMemo(() => {
    if (visibleColumnIds && visibleColumnIds.length > 0) {
      return visibleColumnIds;
    }
    return resolveVisibleInvoiceTableColumns({ tableColumns: DEFAULT_INVOICE_TABLE_COLUMNS });
  }, [visibleColumnIds]);

  const columnDefs = useMemo(() => {
    const defs: Record<InvoiceTableColumnId, SortableListTableColumn<Invoice, InvoiceSortField>> = {
      invoiceNumber: {
        field: 'invoiceNumber',
        header: t('invoices.table.number', { defaultValue: 'Number' }),
        cell: (invoice) => {
          const contactName = invoice.contactName?.trim() || '';
          const contactType =
            invoice.contactId != null ? contactTypeById.get(String(invoice.contactId)) : undefined;
          const typeLabel = contactType
            ? t(`contacts.type.${contactType}`, {
                defaultValue: contactType === 'private' ? 'Private' : 'Company',
              })
            : null;
          const status = invoice.status || 'draft';
          const totalLabel = formatInvoiceMoney(
            resolveInvoiceTotals(invoice).total,
            invoice.currency || 'SEK',
          );
          const updatedLabel = invoice.updatedAt ? formatDateTimeShort(invoice.updatedAt) : null;
          const TypeIcon =
            contactType === 'private' ? User : contactType === 'company' ? Users : null;
          const hasSubtitle = Boolean(totalLabel || updatedLabel);

          const numberRow = (
            <div className="flex min-w-0 items-center gap-1.5">
              <span
                className="min-w-0 truncate font-mono text-xs font-extrabold text-foreground transition-colors group-hover:text-primary"
                title={formatDisplayNumber('invoices', invoice.invoiceNumber || invoice.id)}
              >
                {formatDisplayNumber('invoices', invoice.invoiceNumber || invoice.id)}
              </span>
              {TypeIcon ? (
                <span title={typeLabel ?? undefined} className="inline-flex shrink-0">
                  <SectionCategoryIcon
                    icon={TypeIcon}
                    className={cn(
                      'h-5 w-5 [&_svg]:h-3 [&_svg]:w-3',
                      contactType ? CONTACT_TYPE_ICON_SHELL_CLASS[contactType] : undefined,
                    )}
                  />
                </span>
              ) : null}
              {contactName ? (
                <span
                  className="min-w-0 truncate text-xs font-medium text-foreground"
                  title={contactName}
                >
                  {contactName}
                </span>
              ) : null}
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
          );

          if (!hasSubtitle) {
            return numberRow;
          }

          return (
            <div className="flex min-w-0 flex-col gap-0.5">
              {numberRow}
              <div className="flex min-w-0 items-center gap-1.5">
                {totalLabel ? (
                  <span className="shrink-0 tabular-nums text-[10px] font-normal leading-tight text-slate-400 dark:text-slate-500">
                    {totalLabel}
                  </span>
                ) : null}
                {updatedLabel ? (
                  <span className="shrink-0 tabular-nums text-[10px] font-normal leading-tight text-slate-400 dark:text-slate-500">
                    {t('common.updated')} {updatedLabel}
                  </span>
                ) : null}
              </div>
            </div>
          );
        },
      },
      invoiceType: {
        field: 'invoiceType',
        header: t('invoices.invoiceType', { defaultValue: 'Invoice type' }),
        className: 'hidden sm:table-cell',
        cell: (invoice) => {
          const type = invoice.invoiceType || 'invoice';
          return (
            <span className="text-xs font-medium text-foreground">
              {t(`invoices.type.${type}`, { defaultValue: type })}
            </span>
          );
        },
      },
      contactName: {
        field: 'contactName',
        header: t('invoices.fieldContact', { defaultValue: 'Customer' }),
        cell: (invoice) => (
          <span
            className="block min-w-0 truncate font-extrabold text-foreground transition-colors group-hover:text-primary"
            title={invoice.contactName || undefined}
          >
            {invoice.contactName || '—'}
          </span>
        ),
      },
      status: {
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
      total: {
        field: 'total',
        header: t('invoices.table.total', { defaultValue: 'Total' }),
        className: 'hidden sm:table-cell',
        cell: (invoice) => (
          <span className="tabular-nums text-xs text-foreground">
            {formatInvoiceMoney(resolveInvoiceTotals(invoice).total, invoice.currency || 'SEK')}
          </span>
        ),
      },
      dueDate: {
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
            <span className="text-xs text-muted-foreground">
              {formatInvoiceListDate(invoice.dueDate)}
            </span>
          );
        },
      },
      createdAt: {
        field: 'createdAt',
        header: t('common.created'),
        className: 'hidden lg:table-cell',
        cell: (invoice) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatDateTimeShort(invoice.createdAt) || '—'}
          </span>
        ),
      },
      updatedAt: {
        field: 'updatedAt',
        header: t('common.updated'),
        className: 'hidden lg:table-cell',
        cell: (invoice) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatDateTimeShort(invoice.updatedAt) || '—'}
          </span>
        ),
      },
    };
    return defs;
  }, [t, contactTypeById]);

  const columns = useMemo(
    () =>
      orderedVisibleIds
        .map((id) => columnDefs[id])
        .filter((col): col is SortableListTableColumn<Invoice, InvoiceSortField> => Boolean(col)),
    [orderedVisibleIds, columnDefs],
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
      subtleRowDividers
      headerBarClassName="bg-sky-50 dark:bg-sky-950/40"
      headerCellClassName="text-sky-800 dark:text-sky-200 hover:bg-sky-100/80 dark:hover:bg-sky-900/40"
      selection={
        selectionEnabled
          ? {
              isSelected,
              onCheckboxMouseDown,
              onCheckboxChange,
              allVisibleSelected,
              onHeaderCheckboxChange,
              selectAllAriaLabel: t('common.selectAllVisible'),
              selectRowAriaLabel: (selected) =>
                selected ? t('common.unselectRow') : t('common.selectRow'),
            }
          : undefined
      }
      pluginName="invoices"
      dataListItem={(invoice) => invoice}
    />
  );
}

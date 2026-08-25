import {
  CheckSquare,
  ArrowDown,
  ArrowUp,
  FileSpreadsheet,
  FileText,
  Plus,
  Trash2,
  XCircle,
} from 'lucide-react';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useApp } from '@/core/api/AppContext';
import { useQuickContextPreview } from '@/core/hooks/useQuickContextPreview';
import { nextListTableSort } from '@/core/list/listViewMode';
import {
  useEffectiveCardColumnCount,
  useEffectiveColumnCount,
  useIsEffectiveTableView,
} from '@/core/list/effectiveListViewMode';
import { useShiftRangeListSelection } from '@/core/hooks/useShiftRangeListSelection';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import { ListColumnLayoutToggle } from '@/core/ui/ListColumnLayoutToggle';
import { ListEmptyState } from '@/core/ui/ListEmptyState';
import { LIST_FILTER_STAT_ROW_CLASS, ListFilterStatCard } from '@/core/ui/ListFilterStatCard';
import { ListFooterBar } from '@/core/ui/ListFooterBar';
import { ListToolbar } from '@/core/ui/ListToolbar';
import { useMobileActions } from '@/core/ui/MobileActionsContext';
import { ListSearchInput } from '@/core/ui/ListSearchInput';
import { exportToCSV, exportToPDF } from '@/core/utils/exportUtils';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';

import { useInvoices } from '../hooks/useInvoices';
import { invoicesNavigation } from '../navigation';
import type { Invoice } from '../context/InvoicesContext';
import {
  getInitialInvoiceColumnCount,
  resolveInvoiceColumnCount,
  INVOICES_COLUMN_COUNT_STORAGE_KEY,
  INVOICES_SETTINGS_KEY,
  type InvoiceColumnCount,
} from '../utils/invoiceColumnCount';
import {
  invoiceMatchesListFilters,
  toggleInvoiceListFilter,
  type InvoiceListFilter,
  type InvoiceListFilterSelection,
} from '../utils/invoiceListFilter';
import {
  compareInvoicesByField,
  isInvoiceStringSortField,
  type InvoiceSortField,
  type InvoiceSortOrder,
} from '../utils/invoiceListSort';
import {
  getInitialInvoiceListViewMode,
  persistInvoiceListViewModeSession,
  resolveInvoiceListViewMode,
  type InvoiceListViewMode,
} from '../utils/invoiceListViewMode';

import { InvoiceListItem } from './InvoiceListItem';
import { InvoiceListTable } from './InvoiceListTable';
import { InvoiceQuickContextPanel } from './InvoiceQuickContextPanel';

type SortField = InvoiceSortField;
type SortOrder = InvoiceSortOrder;

const SORT_FIELD_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'createdAt', label: 'Created' },
  { value: 'updatedAt', label: 'Updated' },
  { value: 'contactName', label: 'Customer' },
  { value: 'invoiceNumber', label: 'Invoice #' },
  { value: 'status', label: 'Status' },
  { value: 'total', label: 'Total' },
  { value: 'dueDate', label: 'Due date' },
  { value: 'issueDate', label: 'Issue date' },
];

export function InvoicesList() {
  const { t } = useTranslation();
  const {
    invoices,
    openInvoiceForView,
    openInvoiceForEdit,
    openInvoicesPanel,
    deleteInvoices,
    selectedInvoiceIds,
    toggleInvoiceSelected,
    mergeIntoInvoiceSelection,
    selectAllInvoices,
    clearInvoiceSelection,
    selectedCount,
    isSelected,
    recentlyDuplicatedInvoiceId,
  } = useInvoices();
  const { getSettings, updateSettings, settingsVersion } = useApp();
  const { attemptNavigation } = useGlobalNavigationGuard();

  useMobileActions({
    onAdd: () => attemptNavigation(() => openInvoicesPanel(null)),
  });

  const [currentPage, setCurrentPage] = useState<string>('invoices');
  const [searchTerm, setSearchTerm] = useState('');
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [primarySort, setPrimarySort] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [columnCount, setColumnCountState] = useState<InvoiceColumnCount>(
    getInitialInvoiceColumnCount,
  );
  const [listViewMode, setListViewModeState] = useState<InvoiceListViewMode>(
    getInitialInvoiceListViewMode,
  );
  const [activeFilters, setActiveFilters] = useState<InvoiceListFilterSelection>([]);

  useEffect(() => {
    const saved = localStorage.getItem('homebase:currentPage');
    if (saved) {
      setCurrentPage(saved);
    }
    const handleStorageChange = () => {
      const updated = localStorage.getItem('homebase:currentPage');
      if (updated) {
        setCurrentPage(updated);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  useEffect(() => {
    const handlePageChange = (e: CustomEvent<string>) => {
      setCurrentPage(e.detail);
    };
    window.addEventListener('homebase:pageChange' as any, handlePageChange);
    return () => window.removeEventListener('homebase:pageChange' as any, handlePageChange);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getSettings(INVOICES_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        const next = resolveInvoiceColumnCount(settings);
        setColumnCountState(next);
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(INVOICES_COLUMN_COUNT_STORAGE_KEY, String(next));
        }
        const nextView = resolveInvoiceListViewMode(settings);
        setListViewModeState(nextView);
        persistInvoiceListViewModeSession(nextView);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  const setColumnCount = useCallback(
    (count: InvoiceColumnCount) => {
      setColumnCountState(count);
      setListViewModeState('cards');
      persistInvoiceListViewModeSession('cards');
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(INVOICES_COLUMN_COUNT_STORAGE_KEY, String(count));
      }
      updateSettings(INVOICES_SETTINGS_KEY, { columnCount: count, listViewMode: 'cards' }).catch(
        () => {},
      );
    },
    [updateSettings],
  );

  const setListViewMode = useCallback(
    (mode: InvoiceListViewMode) => {
      setListViewModeState(mode);
      persistInvoiceListViewModeSession(mode);
      updateSettings(INVOICES_SETTINGS_KEY, { listViewMode: mode }).catch(() => {});
    },
    [updateSettings],
  );

  const handlePrimarySortChange = (field: SortField) => {
    setPrimarySort(field);
    setSortOrder(isInvoiceStringSortField(field) ? 'asc' : 'desc');
  };

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const handleTableSort = useCallback(
    (field: SortField) => {
      const next = nextListTableSort(primarySort, sortOrder, field, isInvoiceStringSortField);
      setPrimarySort(next.field);
      setSortOrder(next.order);
    },
    [primarySort, sortOrder],
  );

  const isTableView = useIsEffectiveTableView(listViewMode);
  const effectiveColumnCount = useEffectiveColumnCount(columnCount);
  const effectiveCardColumnCount = useEffectiveCardColumnCount(columnCount);

  const sortedInvoices = useMemo(() => {
    const byFilter = invoices.filter((invoice) =>
      invoiceMatchesListFilters(invoice, activeFilters),
    );

    const q = searchTerm.toLowerCase();
    const filtered = byFilter.filter(
      (invoice) =>
        (invoice.invoiceNumber || '').toLowerCase().includes(q) ||
        (invoice.contactName || '').toLowerCase().includes(q) ||
        (invoice.notes || '').toLowerCase().includes(q) ||
        (invoice.status || '').toLowerCase().includes(q) ||
        invoice.id.toLowerCase().includes(q),
    );

    return [...filtered].sort((a, b) => compareInvoicesByField(a, b, primarySort, sortOrder));
  }, [invoices, searchTerm, primarySort, sortOrder, activeFilters]);

  const isFilterActive = (filter: InvoiceListFilter) => activeFilters.includes(filter);
  const toggleFilter = (filter: InvoiceListFilter) => {
    setActiveFilters((prev) => toggleInvoiceListFilter(prev, filter));
  };

  const stats = useMemo(
    () => ({
      total: invoices.length,
      draft: invoices.filter((i) => i.status === 'draft').length,
      paid: invoices.filter((i) => i.status === 'paid').length,
      overdue: invoices.filter((i) => i.status === 'overdue').length,
    }),
    [invoices],
  );

  const visibleInvoiceIds = useMemo(
    () => sortedInvoices.map((inv) => String(inv.id)),
    [sortedInvoices],
  );

  const { handleRowCheckboxShiftMouseDown, onVisibleRowCheckboxChange } =
    useShiftRangeListSelection({
      orderedVisibleIds: visibleInvoiceIds,
      mergeIntoSelection: mergeIntoInvoiceSelection,
      toggleOne: toggleInvoiceSelected,
    });

  const allVisibleSelected = useMemo(
    () => visibleInvoiceIds.length > 0 && visibleInvoiceIds.every((id) => isSelected(id)),
    [visibleInvoiceIds, isSelected],
  );

  const handleHeaderCheckboxChange = () => {
    if (allVisibleSelected) {
      clearInvoiceSelection();
    } else {
      selectAllInvoices(visibleInvoiceIds);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedInvoiceIds.length === 0) {
      return;
    }
    setDeleting(true);
    try {
      await deleteInvoices(selectedInvoiceIds);
      setShowBulkDeleteModal(false);
    } catch (err: any) {
      console.error('Bulk delete failed:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleExportCSV = () => {
    if (selectedInvoiceIds.length === 0) {
      alert('Please select invoices to export');
      return;
    }
    const selectedInvoices = invoices.filter((inv) => selectedInvoiceIds.includes(String(inv.id)));
    const csvHeaders = [
      'invoiceNumber',
      'contactName',
      'currency',
      'total',
      'status',
      'issueDate',
      'dueDate',
      'createdAt',
    ];
    const csvData = selectedInvoices.map((inv) => ({
      invoiceNumber: inv.invoiceNumber ?? '',
      contactName: inv.contactName ?? '',
      currency: inv.currency ?? '',
      total: inv.total ?? 0,
      status: inv.status ?? '',
      issueDate:
        inv.issueDate instanceof Date ? inv.issueDate.toISOString() : String(inv.issueDate ?? ''),
      dueDate: inv.dueDate instanceof Date ? inv.dueDate.toISOString() : String(inv.dueDate ?? ''),
      createdAt:
        inv.createdAt instanceof Date ? inv.createdAt.toISOString() : String(inv.createdAt ?? ''),
    }));
    const filename = `invoices-export-${new Date().toISOString().split('T')[0]}`;
    exportToCSV(csvData, filename, csvHeaders);
  };

  const handleExportPDF = async () => {
    if (selectedInvoiceIds.length === 0) {
      alert('Please select invoices to export');
      return;
    }
    const selectedInvoices = invoices.filter((inv) => selectedInvoiceIds.includes(String(inv.id)));
    const pdfHeaders = [
      { key: 'invoiceNumber', label: 'Invoice #' },
      { key: 'contactName', label: 'Contact' },
      { key: 'currency', label: 'Currency' },
      { key: 'total', label: 'Total' },
      { key: 'status', label: 'Status' },
      { key: 'dueDate', label: 'Due Date' },
    ];
    const pdfData = selectedInvoices.map((inv) => ({
      invoiceNumber: inv.invoiceNumber ?? '',
      contactName: inv.contactName ?? '',
      currency: inv.currency ?? '',
      total: inv.total ?? 0,
      status: inv.status ?? '',
      dueDate:
        inv.dueDate instanceof Date
          ? inv.dueDate.toLocaleDateString('sv-SE')
          : String(inv.dueDate ?? ''),
    }));
    const filename = `invoices-export-${new Date().toISOString().split('T')[0]}`;
    await exportToPDF(pdfData, filename, pdfHeaders, 'Invoices Export');
  };

  const {
    previewItem: previewInvoice,
    setPreviewItem: setPreviewInvoice,
    showQuickContext,
    markPendingAndOpen,
    activateRow,
  } = useQuickContextPreview({
    storeKey: 'invoices',
    items: invoices,
    getItemId: (invoice) => String(invoice.id),
  });

  const handleOpenForView = (invoice: Invoice) => {
    markPendingAndOpen(invoice, () => attemptNavigation(() => openInvoiceForView(invoice)));
  };

  const handleRowActivate = (invoice: Invoice) => {
    activateRow(invoice, (item) => attemptNavigation(() => openInvoiceForView(item)));
  };

  const handleSubNavClick = (page: string) => {
    attemptNavigation(() => {
      localStorage.setItem('homebase:currentPage', page);
      setCurrentPage(page);
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'homebase:currentPage', newValue: page }),
      );
      window.dispatchEvent(new CustomEvent('homebase:pageChange', { detail: page }));
    });
  };

  return (
    <div className="plugin-invoices min-h-full bg-background px-4 pt-2 pb-4 md:px-6 md:py-4">
      <div className="space-y-3">
        <div className="hidden items-start justify-between gap-4 md:flex">
          <div className="min-w-0 space-y-1">
            <h2 className="truncate text-xl font-semibold tracking-tight">{t('nav.invoices')}</h2>
            <p className="text-sm text-muted-foreground">{t('invoices.listDescription')}</p>
          </div>
          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            className="h-9 flex-1 md:flex-initial px-3 text-xs"
            onClick={() => attemptNavigation(() => openInvoicesPanel(null))}
          >
            {t('invoices.addInvoice')}
          </Button>
        </div>

        <div className={cn(LIST_FILTER_STAT_ROW_CLASS, 'md:grid-cols-2 md:gap-2 lg:grid-cols-4')}>
          <ListFilterStatCard
            label="Total"
            value={stats.total}
            dotClassName="bg-blue-500"
            active={activeFilters.length === 0}
            onClick={() => setActiveFilters([])}
          />
          <ListFilterStatCard
            label="Draft"
            value={stats.draft}
            dotClassName="bg-slate-500"
            active={isFilterActive('draft')}
            onClick={() => toggleFilter('draft')}
          />
          <ListFilterStatCard
            label="Paid"
            value={stats.paid}
            dotClassName="bg-emerald-500"
            active={isFilterActive('paid')}
            onClick={() => toggleFilter('paid')}
          />
          <ListFilterStatCard
            label="Overdue"
            value={stats.overdue}
            dotClassName="bg-rose-500"
            active={isFilterActive('overdue')}
            onClick={() => toggleFilter('overdue')}
          />
        </div>

        {invoicesNavigation.submenu && (
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {invoicesNavigation.submenu
              .sort((a, b) => a.order - b.order)
              .map((subItem) => {
                const SubIcon = subItem.icon;
                const isActive = subItem.page === currentPage;
                return (
                  <Button
                    key={subItem.page}
                    variant="ghost"
                    onClick={() => handleSubNavClick(subItem.page)}
                    className={cn(
                      'h-auto rounded-lg px-3 py-2 text-xs font-medium transition-colors sm:px-5 sm:py-3 sm:text-sm',
                      'flex items-center gap-1.5 sm:gap-2',
                      isActive
                        ? 'border border-primary bg-primary/10 text-primary hover:bg-primary/15'
                        : 'border-transparent bg-muted text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    <SubIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span>{subItem.label}</span>
                  </Button>
                );
              })}
          </div>
        )}

        <BulkDeleteModal
          isOpen={showBulkDeleteModal}
          onClose={() => setShowBulkDeleteModal(false)}
          onConfirm={handleBulkDelete}
          itemCount={selectedCount}
          itemLabel="invoices"
          isLoading={deleting}
        />

        <div className="flex flex-col gap-3">
          <ListToolbar
            selectedCount={selectedCount}
            showSelectAll={sortedInvoices.length > 0}
            selectAll={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 px-3 text-xs text-foreground underline decoration-border hover:bg-primary/10 hover:text-primary hover:decoration-primary"
                icon={CheckSquare}
                onClick={handleHeaderCheckboxChange}
              >
                Select all
              </Button>
            }
            search={
              <ListSearchInput
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder={t('invoices.searchPlaceholder', { defaultValue: 'Search invoices…' })}
              />
            }
            trailing={
              <>
                {!isTableView ? (
                  <div className="mr-1 flex items-center gap-1">
                    <Select
                      value={primarySort}
                      onValueChange={(value) => handlePrimarySortChange(value as SortField)}
                    >
                      <SelectTrigger
                        className="h-7 w-[140px] rounded-md border-border/30 bg-background px-2 text-xs shadow-none"
                        aria-label="Sort by"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent
                        position="item-aligned"
                        className="rounded-xl border-border/50 shadow-xl"
                      >
                        {SORT_FIELD_OPTIONS.map((option) => (
                          <SelectItem
                            key={option.value}
                            value={option.value}
                            className="rounded-md text-xs"
                          >
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 px-0 text-xs"
                      onClick={toggleSortOrder}
                      aria-label={sortOrder === 'asc' ? 'Sort descending' : 'Sort ascending'}
                      title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                    >
                      {sortOrder === 'asc' ? (
                        <ArrowUp className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                ) : null}
                <ListColumnLayoutToggle
                  columnCount={columnCount}
                  listViewMode={listViewMode}
                  onSelectColumns={setColumnCount}
                  onSelectTable={() => setListViewMode('table')}
                  columnAriaLabel={(count) => `${count} columns`}
                  tableAriaLabel={t('common.tableView', { defaultValue: 'Table view' })}
                />
              </>
            }
            bulkActions={
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 px-3 text-xs hover:bg-primary/10 hover:text-primary"
                  icon={FileSpreadsheet}
                  onClick={handleExportCSV}
                >
                  {t('common.exportCsv')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 px-3 text-xs hover:bg-primary/10 hover:text-primary"
                  icon={FileText}
                  onClick={handleExportPDF}
                >
                  {t('common.exportPdf')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 px-3 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                  icon={Trash2}
                  onClick={() => setShowBulkDeleteModal(true)}
                >
                  {t('common.delete')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 px-3 text-xs text-destructive hover:bg-destructive/10"
                  icon={XCircle}
                  onClick={clearInvoiceSelection}
                >
                  {t('common.clearSelection', { defaultValue: 'Clear' })}
                </Button>
              </>
            }
          />

          {sortedInvoices.length === 0 ? (
            <ListEmptyState
              message={
                searchTerm || activeFilters.length > 0
                  ? t('invoices.noMatch', { defaultValue: 'No invoices match your filters.' })
                  : t('invoices.noYet', { defaultValue: 'No invoices yet' })
              }
              createLabel={
                !searchTerm && activeFilters.length === 0 ? t('invoices.addInvoice') : undefined
              }
              onCreate={
                !searchTerm && activeFilters.length === 0
                  ? () => attemptNavigation(() => openInvoicesPanel(null))
                  : undefined
              }
            />
          ) : (
            <div className="flex items-start gap-4">
              {showQuickContext && previewInvoice ? (
                <aside className="w-[min(100%,36rem)] shrink-0 self-start lg:sticky lg:top-4">
                  <InvoiceQuickContextPanel
                    invoice={previewInvoice}
                    onClose={() => setPreviewInvoice(null)}
                    onOpenFullProfile={() => handleOpenForView(previewInvoice)}
                    onEdit={() => {
                      markPendingAndOpen(previewInvoice, () =>
                        attemptNavigation(() => openInvoiceForEdit(previewInvoice)),
                      );
                    }}
                  />
                </aside>
              ) : null}
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                {isTableView ? (
                  <InvoiceListTable
                    invoices={sortedInvoices}
                    primarySort={primarySort}
                    sortOrder={sortOrder}
                    onSort={handleTableSort}
                    isSelected={isSelected}
                    onRowClick={handleRowActivate}
                    onCheckboxMouseDown={handleRowCheckboxShiftMouseDown}
                    onCheckboxChange={onVisibleRowCheckboxChange}
                    allVisibleSelected={allVisibleSelected}
                    onHeaderCheckboxChange={handleHeaderCheckboxChange}
                    recentlyDuplicatedInvoiceId={recentlyDuplicatedInvoiceId}
                    activeInvoiceId={previewInvoice?.id ?? null}
                  />
                ) : (
                  <div
                    className={cn(
                      'grid gap-3',
                      effectiveColumnCount === 1 && 'grid-cols-1',
                      effectiveColumnCount === 2 && 'grid-cols-1 sm:grid-cols-2',
                      effectiveColumnCount === 3 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
                    )}
                  >
                    {sortedInvoices.map((invoice, index) => (
                      <InvoiceListItem
                        key={invoice.id}
                        invoice={invoice}
                        selected={isSelected(String(invoice.id))}
                        highlighted={recentlyDuplicatedInvoiceId === String(invoice.id)}
                        active={
                          previewInvoice != null && String(previewInvoice.id) === String(invoice.id)
                        }
                        columnCount={effectiveCardColumnCount}
                        onClick={() => handleRowActivate(invoice)}
                        checkbox={
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-border"
                            checked={isSelected(String(invoice.id))}
                            onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                            onChange={() => onVisibleRowCheckboxChange(String(invoice.id))}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={
                              isSelected(String(invoice.id))
                                ? t('common.unselectRow')
                                : t('common.selectRow')
                            }
                          />
                        }
                      />
                    ))}
                  </div>
                )}

                <ListFooterBar
                  meta={t('common.showingOf', {
                    defaultValue: `Showing ${sortedInvoices.length} of ${invoices.length}`,
                    showing: sortedInvoices.length,
                    total: invoices.length,
                  })}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

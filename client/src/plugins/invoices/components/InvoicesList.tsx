import {
  AlertCircle,
  BadgeCheck,
  CheckSquare,
  ArrowDown,
  ArrowUp,
  FileEdit,
  FileSpreadsheet,
  FileText,
  LayoutGrid,
  Plus,
  Settings,
  Trash2,
  XCircle,
} from 'lucide-react';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { ExpandableIconButton } from '@/components/ui/expandable-icon-button';
import { RoundExpandableSearch } from '@/components/ui/round-expandable-search';
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
import { BulkActionRoundBar, type BulkActionRoundItem } from '@/core/ui/BulkActionRoundBar';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import {
  LIST_FILTER_AND_SORT_ROW_CLASS,
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
  LIST_FILTER_CHIP_ROW_CLASS,
  LIST_FILTER_CHIP_SLOT_CLASS,
  LIST_FILTER_SORT_CLUSTER_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { ListColumnLayoutToggle } from '@/core/ui/ListColumnLayoutToggle';
import { ListEmptyState } from '@/core/ui/ListEmptyState';
import { ListFooterBar } from '@/core/ui/ListFooterBar';
import { useMobileActions, useRegisterMobileSearch } from '@/core/ui/MobileActionsContext';
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
import {
  resolveVisibleInvoiceTableColumns,
  type InvoiceTableColumnId,
} from '../utils/invoiceTableColumns';

import { InvoiceListItem } from './InvoiceListItem';
import { InvoiceListTable } from './InvoiceListTable';
import { InvoiceQuickContextPanel } from './InvoiceQuickContextPanel';
import { InvoiceSettingsView, type InvoiceSettingsCategory } from './InvoiceSettingsView';
import {
  PLUGIN_PAGE_HEADER_ACTIONS_CLASS,
  PLUGIN_PAGE_LIST_SHELL_CLASS,
  PLUGIN_PAGE_SECTION_GAP_CLASS,
  PLUGIN_PAGE_TITLE_CLASS,
  PLUGIN_PAGE_TITLE_ROW_CLASS,
} from '@/core/ui/pluginPageStyles';
import { usePersistedListSearch } from '@/core/ui/usePersistedListSearch';

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
    invoicesContentView,
    openInvoiceSettings,
    closeInvoiceSettingsView,
  } = useInvoices();
  const { getSettings, updateSettings, settingsVersion } = useApp();
  const { attemptNavigation } = useGlobalNavigationGuard();

  useMobileActions({
    onAdd: () => attemptNavigation(() => openInvoicesPanel(null)),
    onSettings: openInvoiceSettings,
  });

  const [currentPage, setCurrentPage] = useState<string>('invoices');
  const { searchTerm, setSearchTerm } = usePersistedListSearch('invoices');
  useRegisterMobileSearch({
    value: searchTerm,
    onChange: setSearchTerm,
    placeholder: t('invoices.searchPlaceholder', { defaultValue: 'Search invoices…' }),
  });
  const [selectionMode, setSelectionMode] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [primarySort, setPrimarySort] = useState<SortField>('invoiceNumber');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [columnCount, setColumnCountState] = useState<InvoiceColumnCount>(
    getInitialInvoiceColumnCount,
  );
  const [listViewMode, setListViewModeState] = useState<InvoiceListViewMode>(
    getInitialInvoiceListViewMode,
  );
  const [visibleColumnIds, setVisibleColumnIds] = useState<InvoiceTableColumnId[]>(() =>
    resolveVisibleInvoiceTableColumns(null),
  );
  const [activeFilters, setActiveFilters] = useState<InvoiceListFilterSelection>([]);
  const [settingsCategory, setSettingsCategory] = useState<InvoiceSettingsCategory>('columns');

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
        const resolved = resolveInvoiceColumnCount(settings);
        const next = (resolved === 1 || resolved === 2 ? 3 : resolved) as InvoiceColumnCount;
        setColumnCountState(next);
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(INVOICES_COLUMN_COUNT_STORAGE_KEY, String(next));
        }
        if (next !== resolved) {
          updateSettings(INVOICES_SETTINGS_KEY, { columnCount: next }).catch(() => {});
        }
        const nextView = resolveInvoiceListViewMode(settings);
        setListViewModeState(nextView);
        persistInvoiceListViewModeSession(nextView);
        setVisibleColumnIds(resolveVisibleInvoiceTableColumns(settings));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  const setColumnCount = useCallback(
    (_count: InvoiceColumnCount) => {
      const next = 3 as InvoiceColumnCount;
      setColumnCountState(next);
      setListViewModeState('cards');
      persistInvoiceListViewModeSession('cards');
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(INVOICES_COLUMN_COUNT_STORAGE_KEY, String(next));
      }
      updateSettings(INVOICES_SETTINGS_KEY, { columnCount: next, listViewMode: 'cards' }).catch(
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

  const quickContextOpen = Boolean(showQuickContext && previewInvoice);
  const effectiveColumnCount = useEffectiveColumnCount(columnCount, { quickContextOpen });
  const effectiveCardColumnCount = useEffectiveCardColumnCount(columnCount, { quickContextOpen });

  const handleOpenForView = (invoice: Invoice) => {
    markPendingAndOpen(invoice, () => attemptNavigation(() => openInvoiceForView(invoice)));
  };

  const handleEnterSelectionMode = () => {
    setSelectionMode(true);
  };

  const handleExitSelectionMode = () => {
    clearInvoiceSelection();
    setSelectionMode(false);
  };

  const handleRowActivate = (invoice: Invoice) => {
    if (selectionMode) {
      toggleInvoiceSelected(String(invoice.id));
      return;
    }
    activateRow(invoice, (item) => attemptNavigation(() => openInvoiceForView(item)));
  };

  const bulkRoundActions = useMemo((): BulkActionRoundItem[] => {
    const disabled = selectedCount === 0;
    return [
      {
        key: 'csv',
        label: t('common.exportCsv'),
        icon: FileSpreadsheet,
        disabled,
        onClick: handleExportCSV,
      },
      {
        key: 'pdf',
        label: t('common.exportPdf'),
        icon: FileText,
        disabled,
        onClick: () => {
          void handleExportPDF();
        },
      },
      {
        key: 'delete',
        label: t('common.delete'),
        icon: Trash2,
        disabled,
        tone: 'destructive',
        onClick: () => setShowBulkDeleteModal(true),
      },
    ];
  }, [selectedCount, t, handleExportCSV, handleExportPDF]);

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

  if (invoicesContentView === 'settings') {
    return (
      <div className="plugin-invoices min-h-full bg-background">
        <div className="px-6 py-4">
          <InvoiceSettingsView
            selectedCategory={settingsCategory}
            onSelectedCategoryChange={setSettingsCategory}
            renderCategoryButtonsInline
            onClose={closeInvoiceSettingsView}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('plugin-invoices', PLUGIN_PAGE_LIST_SHELL_CLASS)}>
      <div className={PLUGIN_PAGE_SECTION_GAP_CLASS}>
        <div className="hidden md:block">
          <div className="flex items-start justify-between gap-6">
            <div className="flex min-w-0 flex-1 flex-col gap-5">
              <div className="min-w-0">
                <div className={PLUGIN_PAGE_TITLE_ROW_CLASS}>
                  <h2 className={PLUGIN_PAGE_TITLE_CLASS}>{t('nav.invoices')}</h2>
                  <ExpandableIconButton
                    icon={Settings}
                    label={t('common.settings')}
                    variant="soft"
                    onClick={openInvoiceSettings}
                  />
                  {sortedInvoices.length > 0 ? (
                    selectionMode ? (
                      <ExpandableIconButton
                        icon={XCircle}
                        label={t('common.clear')}
                        variant="danger"
                        alwaysExpanded
                        onClick={handleExitSelectionMode}
                      />
                    ) : (
                      <ExpandableIconButton
                        icon={CheckSquare}
                        label={t('common.select')}
                        variant="soft"
                        alwaysExpanded
                        onClick={handleEnterSelectionMode}
                      />
                    )
                  ) : null}
                </div>
              </div>
              {selectionMode ? (
                <BulkActionRoundBar
                  selectedCount={selectedCount}
                  actions={bulkRoundActions}
                  className="gap-2"
                />
              ) : null}
            </div>
            <div className={PLUGIN_PAGE_HEADER_ACTIONS_CLASS}>
              <RoundExpandableSearch
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder={t('invoices.searchPlaceholder', { defaultValue: 'Search invoices…' })}
              />
              <ListColumnLayoutToggle
                columnCount={columnCount}
                listViewMode={listViewMode}
                onSelectColumns={setColumnCount}
                onSelectTable={() => setListViewMode('table')}
                columnAriaLabel={(count) => `${count} columns`}
                tableAriaLabel={t('common.tableView', { defaultValue: 'Table view' })}
              />
              <ExpandableIconButton
                icon={Plus}
                label={t('invoices.addInvoice')}
                variant="soft"
                alwaysExpanded
                onClick={() => attemptNavigation(() => openInvoicesPanel(null))}
              />
            </div>
          </div>
        </div>

        <div className={LIST_FILTER_AND_SORT_ROW_CLASS}>
          <div className={cn(LIST_FILTER_CHIP_ROW_CLASS, LIST_FILTER_CHIP_SLOT_CLASS)}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setActiveFilters([])}
              className={cn(
                activeFilters.length === 0 ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>
                Total <span className="tabular-nums font-semibold">({stats.total})</span>
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => toggleFilter('draft')}
              className={cn(
                isFilterActive('draft') ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
              )}
            >
              <FileEdit className="h-3.5 w-3.5" />
              <span>
                Draft <span className="tabular-nums font-semibold">({stats.draft})</span>
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => toggleFilter('paid')}
              className={cn(
                isFilterActive('paid') ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
              )}
            >
              <BadgeCheck className="h-3.5 w-3.5" />
              <span>
                Paid <span className="tabular-nums font-semibold">({stats.paid})</span>
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => toggleFilter('overdue')}
              className={cn(
                isFilterActive('overdue') ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
              )}
            >
              <AlertCircle className="h-3.5 w-3.5" />
              <span>
                Overdue <span className="tabular-nums font-semibold">({stats.overdue})</span>
              </span>
            </Button>
          </div>
          <div className={LIST_FILTER_SORT_CLUSTER_CLASS}>
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
            <div
              className={cn(
                'grid items-start gap-4',
                showQuickContext && previewInvoice ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1',
              )}
            >
              {showQuickContext && previewInvoice ? (
                <aside className="min-w-0 self-start lg:sticky lg:top-4 lg:z-10">
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
              <div className="flex min-w-0 flex-col gap-3">
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
                    selectionEnabled={selectionMode}
                    visibleColumnIds={visibleColumnIds}
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
                          selectionMode ? (
                            <input
                              type="checkbox"
                              className="h-4 w-4"
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
                          ) : undefined
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

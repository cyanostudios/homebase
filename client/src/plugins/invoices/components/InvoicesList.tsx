import {
  Banknote,
  BarChart2,
  CheckSquare,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  FileMinus,
  FileSpreadsheet,
  FileText,
  LayoutGrid,
  Menu,
  Plus,
  Receipt,
  Settings,
  Trash2,
  XCircle,
} from 'lucide-react';
import React, { useState, useMemo, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ExpandableIconButton } from '@/components/ui/expandable-icon-button';
import { RoundExpandableSearch } from '@/components/ui/round-expandable-search';
import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { useApp } from '@/core/api/AppContext';
import { useRegisterBrowseOrder } from '@/core/hooks/useRegisterBrowseOrder';
import { useShiftRangeListSelection } from '@/core/hooks/useShiftRangeListSelection';
import { nextListTableSort } from '@/core/list/listViewMode';
import { BulkActionRoundBar, type BulkActionRoundItem } from '@/core/ui/BulkActionRoundBar';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import {
  DETAIL_VIEW_CARD_CLASS,
  LIST_FILTER_AND_SORT_ROW_CLASS,
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
  LIST_FILTER_CHIP_ROW_CLASS,
  LIST_FILTER_CHIP_SLOT_CLASS,
  LIST_FILTER_SORT_CLUSTER_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { InlinePanelFormActions } from '@/core/ui/InlinePanelFormActions';
import { ListEmptyState } from '@/core/ui/ListEmptyState';
import { ListFooterBar } from '@/core/ui/ListFooterBar';
import { useMobileActions, useRegisterMobileSearch } from '@/core/ui/MobileActionsContext';
import { PLUGIN_PAGE_LIST_SHELL_CLASS, PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { ListFilterChipsToggle } from '@/core/ui/ListFilterChipsToggle';
import { usePersistedFiltersVisible } from '@/core/ui/usePersistedFiltersVisible';
import { usePersistedListSearch } from '@/core/ui/usePersistedListSearch';
import { usePersistedToolbarCollapsed } from '@/core/ui/usePersistedToolbarCollapsed';
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { exportToCSV, exportToPDF } from '@/core/utils/exportUtils';
import { formatDate } from '@/core/utils/dateFormat';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

import { useInvoices } from '../hooks/useInvoices';
import type { Invoice } from '../context/InvoicesContext';
import { INVOICES_SETTINGS_KEY } from '../utils/invoiceColumnCount';
import {
  INVOICE_LIST_FILTERS,
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
  resolveVisibleInvoiceTableColumns,
  type InvoiceTableColumnId,
} from '../utils/invoiceTableColumns';

import { InvoiceListTable } from './InvoiceListTable';
import { InvoiceSettingsView, type InvoiceSettingsCategory } from './InvoiceSettingsView';
import { InvoicesForm } from './InvoicesForm';
import { InvoicesStatisticsView } from './InvoicesStatisticsView';
import { InvoicesView } from './InvoicesView';

type SortField = InvoiceSortField;
type SortOrder = InvoiceSortOrder;

const INVOICES_FILTERS_VISIBLE_STORAGE_KEY = 'homebase.invoices.toolbar.filtersVisible';

const SORT_FIELD_OPTIONS: { value: SortField; labelKey: string }[] = [
  { value: 'createdAt', labelKey: 'common.created' },
  { value: 'updatedAt', labelKey: 'common.updated' },
  { value: 'contactName', labelKey: 'invoices.fieldContact' },
  { value: 'invoiceNumber', labelKey: 'invoices.table.number' },
  { value: 'invoiceType', labelKey: 'invoices.invoiceType' },
  { value: 'status', labelKey: 'invoices.fieldStatus' },
  { value: 'total', labelKey: 'invoices.table.total' },
  { value: 'dueDate', labelKey: 'invoices.fieldDueDate' },
  { value: 'issueDate', labelKey: 'invoices.issueDate' },
];

const TYPE_FILTER_ICONS = {
  invoice: FileText,
  credit_note: FileMinus,
  cash_invoice: Banknote,
  receipt: Receipt,
} as const;

let pendingPreviewInvoiceId: string | null = null;

export function InvoicesList() {
  const { t } = useTranslation();
  const {
    invoices,
    openInvoiceForView,
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
    openInvoiceStatistics,
    closeInvoiceStatisticsView,
    setBrowseOrderIds,
    isInvoicesPanelOpen,
    panelMode,
    currentInvoice,
    saveInvoice,
    closeInvoicesPanel,
    validationErrors,
  } = useInvoices();
  const { getSettings, settingsVersion } = useApp();
  const { attemptNavigation } = useGlobalNavigationGuard();

  useMobileActions({
    onAdd: () => attemptNavigation(() => openInvoicesPanel(null)),
    onSettings: () => attemptNavigation(() => openInvoiceSettings()),
  });

  const isCompactViewport = useMediaQuery('(max-width: 1023px)');
  const showDesktopSplit = !isCompactViewport;

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
  const [visibleColumnIds, setVisibleColumnIds] = useState<InvoiceTableColumnId[]>(() =>
    resolveVisibleInvoiceTableColumns(null),
  );
  const [activeFilters, setActiveFilters] = useState<InvoiceListFilterSelection>([]);
  const [settingsCategory, setSettingsCategory] = useState<InvoiceSettingsCategory>('numbering');
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const { toolbarCollapsed, toggleToolbarCollapsed } = usePersistedToolbarCollapsed();
  const { filtersVisible, setFiltersVisible } = usePersistedFiltersVisible(
    INVOICES_FILTERS_VISIBLE_STORAGE_KEY,
  );
  const restoredPendingInvoiceRef = useRef(false);
  const pageShellRef = useRef<HTMLDivElement>(null);
  const inlineFormRef = useRef<PanelFormHandle | null>(null);
  const [toolbarToggleBox, setToolbarToggleBox] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const inlineForm =
    showDesktopSplit && isInvoicesPanelOpen && (panelMode === 'create' || panelMode === 'edit');
  const inlinePanelView =
    showDesktopSplit && isInvoicesPanelOpen && panelMode === 'view' && currentInvoice != null;
  const detailInvoice = inlinePanelView ? currentInvoice : previewInvoice;
  const activeListInvoiceId =
    (inlineForm || inlinePanelView) && currentInvoice != null
      ? currentInvoice.id
      : (previewInvoice?.id ?? null);

  const updateToolbarToggleBox = useCallback(() => {
    const el = pageShellRef.current;
    if (!el) {
      return;
    }
    const rect = el.getBoundingClientRect();
    const sidebarToggle = document.querySelector<HTMLElement>('[aria-controls="left-sidebar-nav"]');
    const sidebarTop = sidebarToggle?.getBoundingClientRect().top;
    setToolbarToggleBox({
      top: typeof sidebarTop === 'number' ? sidebarTop : rect.top + 4,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  useLayoutEffect(() => {
    updateToolbarToggleBox();
    window.addEventListener('resize', updateToolbarToggleBox);
    const scrollParent = pageShellRef.current?.closest('.overflow-y-auto, .overflow-auto');
    scrollParent?.addEventListener('scroll', updateToolbarToggleBox, { passive: true });
    const ro =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateToolbarToggleBox) : null;
    if (pageShellRef.current && ro) {
      ro.observe(pageShellRef.current);
    }
    return () => {
      window.removeEventListener('resize', updateToolbarToggleBox);
      scrollParent?.removeEventListener('scroll', updateToolbarToggleBox);
      ro?.disconnect();
    };
  }, [updateToolbarToggleBox]);

  useEffect(() => {
    if (restoredPendingInvoiceRef.current || !pendingPreviewInvoiceId) {
      return;
    }
    const restored = invoices.find((invoice) => String(invoice.id) === pendingPreviewInvoiceId);
    if (restored) {
      setPreviewInvoice(restored);
      restoredPendingInvoiceRef.current = true;
      pendingPreviewInvoiceId = null;
    }
  }, [invoices]);

  useEffect(() => {
    let cancelled = false;
    getSettings(INVOICES_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        setVisibleColumnIds(resolveVisibleInvoiceTableColumns(settings));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  useEffect(() => {
    if (!previewInvoice) {
      return;
    }
    const next = invoices.find((invoice) => String(invoice.id) === String(previewInvoice.id));
    if (!next) {
      setPreviewInvoice(null);
      return;
    }
    if (next !== previewInvoice) {
      setPreviewInvoice(next);
    }
  }, [invoices, previewInvoice]);

  useEffect(() => {
    if (!showDesktopSplit || !isInvoicesPanelOpen) {
      return;
    }
    if ((panelMode === 'edit' || panelMode === 'view') && currentInvoice) {
      setPreviewInvoice(currentInvoice);
    }
  }, [showDesktopSplit, isInvoicesPanelOpen, panelMode, currentInvoice]);

  const handlePrimarySortChange = (field: SortField) => {
    setPrimarySort(field);
    setSortOrder(isInvoiceStringSortField(field) ? 'asc' : 'desc');
  };

  const handleTableSort = useCallback(
    (field: SortField) => {
      const next = nextListTableSort(primarySort, sortOrder, field, isInvoiceStringSortField);
      setPrimarySort(next.field);
      setSortOrder(next.order);
    },
    [primarySort, sortOrder],
  );

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
        (invoice.invoiceType || '').toLowerCase().includes(q) ||
        invoice.id.toLowerCase().includes(q),
    );

    return [...filtered].sort((a, b) => compareInvoicesByField(a, b, primarySort, sortOrder));
  }, [invoices, searchTerm, primarySort, sortOrder, activeFilters]);

  const isFilterActive = (filter: InvoiceListFilter) => activeFilters.includes(filter);
  const toggleFilter = (filter: InvoiceListFilter) => {
    setActiveFilters((prev) => toggleInvoiceListFilter(prev, filter));
  };

  const stats = useMemo(() => {
    const byType = Object.fromEntries(
      INVOICE_LIST_FILTERS.map((type) => [
        type,
        invoices.filter((i) => invoiceMatchesListFilters(i, [type])).length,
      ]),
    ) as Record<InvoiceListFilter, number>;
    return {
      total: invoices.length,
      ...byType,
    };
  }, [invoices]);

  const visibleInvoiceIds = useMemo(
    () => sortedInvoices.map((inv) => String(inv.id)),
    [sortedInvoices],
  );

  useRegisterBrowseOrder(setBrowseOrderIds, visibleInvoiceIds);

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
    } catch (err: unknown) {
      console.error('Bulk delete failed:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleExportCSV = useCallback(() => {
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
  }, [invoices, selectedInvoiceIds]);

  const handleExportPDF = useCallback(async () => {
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
      dueDate: formatDate(inv.dueDate) || '',
    }));
    const filename = `invoices-export-${new Date().toISOString().split('T')[0]}`;
    await exportToPDF(pdfData, filename, pdfHeaders, 'Invoices Export');
  }, [invoices, selectedInvoiceIds]);

  const handleOpenForView = (invoice: Invoice) => {
    pendingPreviewInvoiceId = String(invoice.id);
    attemptNavigation(() => openInvoiceForView(invoice));
  };

  const handleEnterSelectionMode = () => {
    setSelectionMode(true);
  };

  const handleExitSelectionMode = () => {
    clearInvoiceSelection();
    setSelectionMode(false);
  };

  const handleRowActivate = (invoice: Invoice) => {
    if (isCompactViewport) {
      handleOpenForView(invoice);
      return;
    }
    if (selectionMode) {
      toggleInvoiceSelected(String(invoice.id));
      return;
    }
    if (
      isInvoicesPanelOpen &&
      (panelMode === 'create' || panelMode === 'edit' || panelMode === 'view')
    ) {
      attemptNavigation(() => {
        closeInvoicesPanel();
        setPreviewInvoice(invoice);
      });
      return;
    }
    setPreviewInvoice((current) =>
      current && String(current.id) === String(invoice.id) ? null : invoice,
    );
  };

  const handleInlineFormSave = useCallback(async () => {
    await inlineFormRef.current?.submit();
  }, []);

  const handleInlineFormClose = useCallback(() => {
    if (inlineFormRef.current) {
      inlineFormRef.current.cancel();
      return;
    }
    closeInvoicesPanel();
  }, [closeInvoicesPanel]);

  const handleInlineFormOnSave = useCallback(
    async (data: any) => {
      const ok = await saveInvoice(data);
      return ok;
    },
    [saveInvoice],
  );

  const handleInlineFormPreview = useCallback(() => {
    inlineFormRef.current?.preview?.();
  }, []);

  const inlineFormHasBlockingErrors = validationErrors.some(
    (e) => !String(e?.message || '').includes('Warning'),
  );

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

  const headerDropdownTriggerClass =
    'gap-1.5 border-0 bg-primary/10 px-3.5 text-sm font-extrabold text-primary shadow-none hover:bg-primary hover:text-primary-foreground';

  const headerDropdownTriggerDangerClass =
    'gap-1.5 border-0 bg-red-600/10 px-3.5 text-sm font-extrabold text-red-700 shadow-none hover:bg-red-600 hover:text-white dark:text-red-400 dark:hover:bg-red-600 dark:hover:text-white';

  const renderFilterChips = () => (
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
          {t('contacts.stats.total', { defaultValue: 'Total' })}{' '}
          <span className="tabular-nums font-semibold">({stats.total})</span>
        </span>
      </Button>
      {INVOICE_LIST_FILTERS.map((filter) => {
        const Icon = TYPE_FILTER_ICONS[filter];
        const label = t(`invoices.type.${filter}`, { defaultValue: filter });
        const count = stats[filter];
        return (
          <Button
            key={filter}
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => toggleFilter(filter)}
            className={cn(
              isFilterActive(filter) ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>
              {label} <span className="tabular-nums font-semibold">({count})</span>
            </span>
          </Button>
        );
      })}
    </div>
  );

  const primarySortLabel =
    SORT_FIELD_OPTIONS.find((option) => option.value === primarySort)?.labelKey ??
    SORT_FIELD_OPTIONS[0].labelKey;

  const renderSortDropdown = (triggerClassName: string) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(headerDropdownTriggerClass, triggerClassName)}
          aria-label={t('invoices.sort')}
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          <span>{t('invoices.sort')}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[14rem] rounded-xl border-border/50 shadow-xl"
      >
        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
          {t(primarySortLabel)}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={primarySort}
          onValueChange={(value) => handlePrimarySortChange(value as SortField)}
        >
          {SORT_FIELD_OPTIONS.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              className="rounded-md text-xs"
              onSelect={(event) => event.preventDefault()}
            >
              {t(option.labelKey)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
          {sortOrder === 'asc' ? t('invoices.sortAsc') : t('invoices.sortDesc')}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={sortOrder}
          onValueChange={(value) => setSortOrder(value as SortOrder)}
        >
          <DropdownMenuRadioItem
            value="asc"
            className="rounded-md text-xs"
            onSelect={(event) => event.preventDefault()}
          >
            <ArrowUp className="mr-2 h-3.5 w-3.5" />
            {t('invoices.sortAsc')}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="desc"
            className="rounded-md text-xs"
            onSelect={(event) => event.preventDefault()}
          >
            <ArrowDown className="mr-2 h-3.5 w-3.5" />
            {t('invoices.sortDesc')}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const renderBulkActionBar = (className?: string) =>
    selectionMode ? (
      <BulkActionRoundBar
        selectedCount={selectedCount}
        actions={bulkRoundActions}
        size="xs"
        className={cn('gap-1.5', className)}
      />
    ) : null;

  const renderSelectControls = (triggerClassName: string) => {
    if (sortedInvoices.length === 0) {
      return null;
    }

    if (!selectionMode) {
      return (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(headerDropdownTriggerClass, triggerClassName)}
          aria-label={t('common.select')}
          aria-pressed={false}
          onClick={handleEnterSelectionMode}
        >
          <CheckSquare className="h-3.5 w-3.5" />
          <span>{t('common.select')}</span>
        </Button>
      );
    }

    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(headerDropdownTriggerDangerClass, triggerClassName)}
        aria-label={t('common.clear')}
        aria-pressed={true}
        onClick={handleExitSelectionMode}
      >
        <XCircle className="h-3.5 w-3.5" />
        <span>{t('common.clear')}</span>
      </Button>
    );
  };

  if (invoicesContentView === 'settings') {
    return (
      <div className="plugin-invoices min-h-full bg-background">
        <div className="px-4 py-4 md:px-6">
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

  if (invoicesContentView === 'statistics') {
    return (
      <div className="plugin-invoices min-h-full bg-background">
        <div className="px-4 py-4 md:px-6">
          <InvoicesStatisticsView onClose={closeInvoiceStatisticsView} />
        </div>
      </div>
    );
  }

  const toolbarEdgeToggle =
    typeof document !== 'undefined' && toolbarToggleBox
      ? createPortal(
          <div
            className="pointer-events-none fixed z-40 hidden justify-center md:flex"
            style={{
              top: toolbarToggleBox.top,
              left: toolbarToggleBox.left,
              width: toolbarToggleBox.width,
            }}
          >
            <div className="pointer-events-auto">
              <RoundIconLabelButton
                icon={Menu}
                label={
                  toolbarCollapsed ? t('invoices.expandToolbar') : t('invoices.collapseToolbar')
                }
                variant={toolbarCollapsed ? 'primary' : 'secondary'}
                size="xs"
                expandOnHover={false}
                className={
                  toolbarCollapsed
                    ? undefined
                    : 'bg-white text-primary shadow-sm hover:bg-primary hover:text-primary-foreground dark:bg-white dark:text-primary dark:hover:bg-primary dark:hover:text-primary-foreground'
                }
                aria-expanded={!toolbarCollapsed}
                aria-controls="invoices-mail-toolbar"
                onClick={toggleToolbarCollapsed}
              />
            </div>
          </div>,
          document.body,
        )
      : null;

  const renderListContent = () => {
    if (sortedInvoices.length === 0) {
      return (
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
      );
    }

    return (
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
        activeInvoiceId={activeListInvoiceId}
        selectionEnabled={selectionMode}
        visibleColumnIds={visibleColumnIds}
      />
    );
  };

  return (
    <>
      {toolbarEdgeToggle}
      <div
        ref={pageShellRef}
        className={cn(
          'plugin-invoices flex min-h-0 flex-1 flex-col',
          PLUGIN_PAGE_LIST_SHELL_CLASS,
          showDesktopSplit
            ? 'overflow-hidden px-3 pb-3 pt-3 md:px-3 md:pb-3 md:pt-3'
            : 'overflow-y-auto md:pt-3',
        )}
      >
        <div
          className={cn(
            'flex min-h-0 min-w-0 flex-1 flex-col',
            showDesktopSplit && toolbarCollapsed ? 'gap-0' : 'gap-3',
          )}
        >
          <div className="relative hidden shrink-0 md:block">
            <div
              className={cn(
                'grid transition-[grid-template-rows,opacity] duration-300 ease-out',
                toolbarCollapsed ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100',
              )}
              aria-hidden={toolbarCollapsed}
            >
              <div className="min-h-0 overflow-hidden">
                <div
                  id="invoices-mail-toolbar"
                  className={cn(
                    'flex flex-wrap items-center justify-between gap-3',
                    toolbarCollapsed && 'pointer-events-none',
                  )}
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                    <h2 className={PLUGIN_PAGE_TITLE_CLASS}>{t('nav.invoices')}</h2>
                    <ExpandableIconButton
                      icon={Settings}
                      label={t('common.settings')}
                      variant="soft"
                      onClick={() => attemptNavigation(() => openInvoiceSettings())}
                    />
                    <ExpandableIconButton
                      icon={BarChart2}
                      label={t('common.statistics', { defaultValue: 'Statistics' })}
                      variant="soft"
                      onClick={() => openInvoiceStatistics()}
                    />
                    {renderSortDropdown('h-11 rounded-full')}
                    <ListFilterChipsToggle
                      visible={filtersVisible}
                      onVisibleChange={setFiltersVisible}
                      className="h-11 rounded-full"
                    />
                    {renderSelectControls('h-11 rounded-full')}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <RoundExpandableSearch
                      value={searchTerm}
                      onChange={setSearchTerm}
                      placeholder={t('invoices.searchPlaceholder', {
                        defaultValue: 'Search invoices…',
                      })}
                    />
                    <ExpandableIconButton
                      icon={Plus}
                      label={t('invoices.addInvoice')}
                      variant="soft"
                      onClick={() => attemptNavigation(() => openInvoicesPanel(null))}
                    />
                  </div>
                </div>
                {filtersVisible ? (
                  <div
                    className={cn(
                      LIST_FILTER_AND_SORT_ROW_CLASS,
                      'pt-2',
                      toolbarCollapsed && 'pointer-events-none',
                    )}
                  >
                    {renderFilterChips()}
                  </div>
                ) : null}
                {renderBulkActionBar('py-3')}
              </div>
            </div>
          </div>

          <div className={cn(LIST_FILTER_AND_SORT_ROW_CLASS, 'shrink-0 md:hidden')}>
            {filtersVisible ? renderFilterChips() : null}
            <div className={LIST_FILTER_SORT_CLUSTER_CLASS}>
              <ListFilterChipsToggle
                visible={filtersVisible}
                onVisibleChange={setFiltersVisible}
                className="h-7 rounded-md"
              />
              {renderSortDropdown('h-7 rounded-md')}
            </div>
          </div>

          {selectionMode ? (
            <div className="shrink-0 py-3 md:hidden">{renderBulkActionBar()}</div>
          ) : null}

          <BulkDeleteModal
            isOpen={showBulkDeleteModal}
            onClose={() => setShowBulkDeleteModal(false)}
            onConfirm={handleBulkDelete}
            itemCount={selectedCount}
            itemLabel="invoices"
            isLoading={deleting}
          />

          <div
            className={cn(
              'grid min-h-0 min-w-0 gap-2',
              showDesktopSplit
                ? 'flex-1 grid-cols-[minmax(220px,20%)_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] items-stretch'
                : 'grid-cols-1 items-start',
            )}
          >
            <div
              className={cn(
                'min-w-0',
                showDesktopSplit && 'h-full min-h-0 overflow-y-auto overscroll-contain',
              )}
            >
              <div className="flex min-w-0 flex-col gap-3">
                {renderListContent()}

                <ListFooterBar
                  meta={t('common.showingOf', {
                    defaultValue: `Showing ${sortedInvoices.length} of ${invoices.length}`,
                    showing: sortedInvoices.length,
                    total: invoices.length,
                  })}
                />
              </div>
            </div>

            {showDesktopSplit ? (
              <aside
                className="h-full min-h-0 min-w-0 overflow-y-auto overscroll-contain"
                role="region"
                aria-label={t('invoices.quickContext.title', { defaultValue: 'Quick context' })}
                aria-live="polite"
              >
                {inlineForm ? (
                  <div className="flex min-h-0 flex-col gap-3">
                    <div className="flex shrink-0 justify-end">
                      <InlinePanelFormActions
                        mode={panelMode === 'edit' ? 'edit' : 'create'}
                        hasBlockingErrors={inlineFormHasBlockingErrors}
                        showPreview
                        onPreview={handleInlineFormPreview}
                        onClose={handleInlineFormClose}
                        onSave={() => {
                          void handleInlineFormSave();
                        }}
                        t={t}
                      />
                    </div>
                    <InvoicesForm
                      ref={inlineFormRef}
                      currentInvoice={currentInvoice as any}
                      onSave={handleInlineFormOnSave}
                      onCancel={closeInvoicesPanel}
                      stacked
                    />
                  </div>
                ) : detailInvoice ? (
                  <InvoicesView invoice={detailInvoice} stacked />
                ) : (
                  <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'p-4 md:p-6')}>
                    <InvoicesStatisticsView />
                  </Card>
                )}
              </aside>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

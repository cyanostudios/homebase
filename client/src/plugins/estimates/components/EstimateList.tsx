import {
  CheckCircle2,
  CheckSquare,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  FileEdit,
  FileSpreadsheet,
  FileText,
  LayoutGrid,
  Menu,
  Plus,
  Send,
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
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { exportToCSV, exportToPDF } from '@/core/utils/exportUtils';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

import { useEstimates } from '../hooks/useEstimates';
import type { Estimate } from '../types/estimate';
import { ESTIMATES_SETTINGS_KEY } from '../utils/estimateColumnCount';
import {
  estimateMatchesListFilters,
  toggleEstimateListFilter,
  type EstimateListFilter,
  type EstimateListFilterSelection,
} from '../utils/estimateListFilter';
import {
  compareEstimatesByField,
  isEstimateStringSortField,
  type EstimateSortField,
  type EstimateSortOrder,
} from '../utils/estimateListSort';
import {
  resolveVisibleEstimateTableColumns,
  type EstimateTableColumnId,
} from '../utils/estimateTableColumns';

import { EstimateForm } from './EstimateForm';
import { EstimateListTable } from './EstimateListTable';
import { EstimateSettingsView } from './EstimateSettingsView';
import { EstimatesStatisticsView } from './EstimatesStatisticsView';
import { EstimateView } from './EstimateView';

type SortField = EstimateSortField;
type SortOrder = EstimateSortOrder;

const ESTIMATES_TOOLBAR_COLLAPSED_STORAGE_KEY = 'homebase.estimates.toolbar.collapsed';
const ESTIMATES_FILTERS_VISIBLE_STORAGE_KEY = 'homebase.estimates.toolbar.filtersVisible';

function readEstimatesToolbarCollapsed(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    return window.localStorage.getItem(ESTIMATES_TOOLBAR_COLLAPSED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeEstimatesToolbarCollapsed(collapsed: boolean): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(ESTIMATES_TOOLBAR_COLLAPSED_STORAGE_KEY, collapsed ? '1' : '0');
  } catch {
    // ignore quota / private mode
  }
}

const SORT_FIELD_OPTIONS: { value: SortField; labelKey: string }[] = [
  { value: 'createdAt', labelKey: 'common.created' },
  { value: 'updatedAt', labelKey: 'common.updated' },
  { value: 'contactName', labelKey: 'estimates.fieldContact' },
  { value: 'estimateNumber', labelKey: 'estimates.table.number' },
  { value: 'status', labelKey: 'estimates.fieldStatus' },
  { value: 'total', labelKey: 'estimates.table.total' },
  { value: 'validTo', labelKey: 'estimates.fieldValidTo' },
];

export function EstimateList() {
  const { t } = useTranslation();
  const {
    estimates,
    openEstimatePanel,
    openEstimateForView,
    deleteEstimates,
    selectedEstimateIds,
    toggleEstimateSelected,
    mergeIntoEstimateSelection,
    selectAllEstimates,
    clearEstimateSelection,
    selectedCount,
    isSelected,
    recentlyDuplicatedEstimateId,
    estimatesContentView,
    openEstimateSettings,
    closeEstimateSettingsView,
    setBrowseOrderIds,
    isEstimatePanelOpen,
    panelMode,
    currentEstimate,
    saveEstimate,
    closeEstimatePanel,
    validationErrors,
  } = useEstimates();
  const { getSettings, settingsVersion } = useApp();
  const { attemptNavigation } = useGlobalNavigationGuard();

  useMobileActions({
    onAdd: () => attemptNavigation(() => openEstimatePanel(null)),
    onSettings: openEstimateSettings,
  });

  const isCompactViewport = useMediaQuery('(max-width: 1023px)');
  const showDesktopSplit = !isCompactViewport;

  const { searchTerm, setSearchTerm } = usePersistedListSearch('estimates');
  useRegisterMobileSearch({
    value: searchTerm,
    onChange: setSearchTerm,
    placeholder: t('estimates.searchPlaceholder'),
  });

  const [selectionMode, setSelectionMode] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [primarySort, setPrimarySort] = useState<SortField>('estimateNumber');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [visibleColumnIds, setVisibleColumnIds] = useState<EstimateTableColumnId[]>(() =>
    resolveVisibleEstimateTableColumns(null),
  );
  const [activeFilters, setActiveFilters] = useState<EstimateListFilterSelection>([]);
  const [previewEstimate, setPreviewEstimate] = useState<Estimate | null>(null);
  const [toolbarCollapsed, setToolbarCollapsed] = useState(readEstimatesToolbarCollapsed);
  const { filtersVisible, setFiltersVisible } = usePersistedFiltersVisible(
    ESTIMATES_FILTERS_VISIBLE_STORAGE_KEY,
  );
  const pageShellRef = useRef<HTMLDivElement>(null);
  const inlineFormRef = useRef<PanelFormHandle | null>(null);
  const [toolbarToggleBox, setToolbarToggleBox] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const inlineForm =
    showDesktopSplit && isEstimatePanelOpen && (panelMode === 'create' || panelMode === 'edit');
  const inlinePanelView =
    showDesktopSplit && isEstimatePanelOpen && panelMode === 'view' && currentEstimate != null;
  const detailEstimate = inlinePanelView ? currentEstimate : previewEstimate;
  const activeListEstimateId =
    (inlineForm || inlinePanelView) && currentEstimate != null
      ? currentEstimate.id
      : (previewEstimate?.id ?? null);

  const toggleToolbarCollapsed = useCallback(() => {
    setToolbarCollapsed((prev) => {
      const next = !prev;
      writeEstimatesToolbarCollapsed(next);
      return next;
    });
  }, []);

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
    let cancelled = false;
    getSettings(ESTIMATES_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        setVisibleColumnIds(resolveVisibleEstimateTableColumns(settings));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  useEffect(() => {
    if (!previewEstimate) {
      return;
    }
    const next = estimates.find((estimate) => String(estimate.id) === String(previewEstimate.id));
    if (!next) {
      setPreviewEstimate(null);
      return;
    }
    if (next !== previewEstimate) {
      setPreviewEstimate(next);
    }
  }, [estimates, previewEstimate]);

  useEffect(() => {
    if (!showDesktopSplit || !isEstimatePanelOpen) {
      return;
    }
    if ((panelMode === 'edit' || panelMode === 'view') && currentEstimate) {
      setPreviewEstimate(currentEstimate);
    }
  }, [showDesktopSplit, isEstimatePanelOpen, panelMode, currentEstimate]);

  const handlePrimarySortChange = (field: SortField) => {
    setPrimarySort(field);
    setSortOrder(isEstimateStringSortField(field) ? 'asc' : 'desc');
  };

  const handleTableSort = useCallback(
    (field: SortField) => {
      const next = nextListTableSort(primarySort, sortOrder, field, isEstimateStringSortField);
      setPrimarySort(next.field);
      setSortOrder(next.order);
    },
    [primarySort, sortOrder],
  );

  const sortedEstimates = useMemo(() => {
    const byFilter = estimates.filter((estimate) =>
      estimateMatchesListFilters(estimate, activeFilters),
    );

    const q = searchTerm.toLowerCase();
    const filtered = byFilter.filter(
      (estimate) =>
        estimate.estimateNumber.toLowerCase().includes(q) ||
        estimate.contactName.toLowerCase().includes(q) ||
        estimate.notes.toLowerCase().includes(q) ||
        estimate.status.toLowerCase().includes(q),
    );

    return [...filtered].sort((a, b) => compareEstimatesByField(a, b, primarySort, sortOrder));
  }, [estimates, searchTerm, primarySort, sortOrder, activeFilters]);

  const isFilterActive = (filter: EstimateListFilter) => activeFilters.includes(filter);
  const toggleFilter = (filter: EstimateListFilter) => {
    setActiveFilters((prev) => toggleEstimateListFilter(prev, filter));
  };

  const stats = useMemo(
    () => ({
      total: estimates.length,
      draft: estimates.filter((e) => e.status === 'draft').length,
      sent: estimates.filter((e) => e.status === 'sent').length,
      accepted: estimates.filter((e) => e.status === 'accepted').length,
    }),
    [estimates],
  );

  const visibleEstimateIds = useMemo(
    () => sortedEstimates.map((estimate) => String(estimate.id)),
    [sortedEstimates],
  );

  useRegisterBrowseOrder(setBrowseOrderIds, visibleEstimateIds);

  const { handleRowCheckboxShiftMouseDown, onVisibleRowCheckboxChange } =
    useShiftRangeListSelection({
      orderedVisibleIds: visibleEstimateIds,
      mergeIntoSelection: mergeIntoEstimateSelection,
      toggleOne: toggleEstimateSelected,
    });

  const allVisibleSelected = useMemo(
    () => visibleEstimateIds.length > 0 && visibleEstimateIds.every((id) => isSelected(id)),
    [visibleEstimateIds, isSelected],
  );

  const handleHeaderCheckboxChange = () => {
    if (allVisibleSelected) {
      clearEstimateSelection();
    } else {
      selectAllEstimates(visibleEstimateIds);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedEstimateIds.length === 0) {
      return;
    }
    setDeleting(true);
    try {
      await deleteEstimates(selectedEstimateIds);
      setShowBulkDeleteModal(false);
    } catch (err: unknown) {
      console.error('Bulk delete failed:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleExportCSV = () => {
    if (selectedEstimateIds.length === 0) {
      return;
    }
    const selectedEstimates = estimates.filter((est) =>
      selectedEstimateIds.includes(String(est.id)),
    );
    const csvHeaders = [
      'estimateNumber',
      'contactName',
      'organizationNumber',
      'currency',
      'total',
      'status',
      'validTo',
      'createdAt',
      'updatedAt',
    ];
    const csvData = selectedEstimates.map((est) => ({
      estimateNumber: est.estimateNumber ?? '',
      contactName: est.contactName ?? '',
      organizationNumber: est.organizationNumber ?? '',
      currency: est.currency ?? '',
      total: est.total ?? 0,
      status: est.status ?? '',
      validTo: est.validTo instanceof Date ? est.validTo.toISOString() : String(est.validTo ?? ''),
      createdAt:
        est.createdAt instanceof Date ? est.createdAt.toISOString() : String(est.createdAt ?? ''),
      updatedAt:
        est.updatedAt instanceof Date ? est.updatedAt.toISOString() : String(est.updatedAt ?? ''),
    }));
    const filename = `estimates-export-${new Date().toISOString().split('T')[0]}`;
    exportToCSV(csvData, filename, csvHeaders);
  };

  const handleExportPDF = async () => {
    if (selectedEstimateIds.length === 0) {
      return;
    }
    const selectedEstimates = estimates.filter((est) =>
      selectedEstimateIds.includes(String(est.id)),
    );
    const pdfHeaders = [
      { key: 'estimateNumber', label: 'Estimate #' },
      { key: 'contactName', label: 'Contact' },
      { key: 'currency', label: 'Currency' },
      { key: 'total', label: 'Total' },
      { key: 'status', label: 'Status' },
      { key: 'validTo', label: 'Valid To' },
      { key: 'createdAt', label: 'Created' },
    ];
    const pdfData = selectedEstimates.map((est) => ({
      estimateNumber: est.estimateNumber ?? '',
      contactName: est.contactName ?? '',
      currency: est.currency ?? '',
      total: est.total ?? 0,
      status: est.status ?? '',
      validTo:
        est.validTo instanceof Date
          ? est.validTo.toLocaleDateString('sv-SE')
          : String(est.validTo ?? ''),
      createdAt:
        est.createdAt instanceof Date
          ? est.createdAt.toLocaleDateString('sv-SE')
          : String(est.createdAt ?? ''),
    }));
    const filename = `estimates-export-${new Date().toISOString().split('T')[0]}`;
    await exportToPDF(pdfData, filename, pdfHeaders, 'Estimates Export');
  };

  const handleOpenForView = (estimate: Estimate) => {
    attemptNavigation(() => openEstimateForView(estimate));
  };

  const handleEnterSelectionMode = () => {
    setSelectionMode(true);
  };

  const handleExitSelectionMode = () => {
    clearEstimateSelection();
    setSelectionMode(false);
  };

  const handleRowActivate = (estimate: Estimate) => {
    if (isCompactViewport) {
      handleOpenForView(estimate);
      return;
    }
    if (selectionMode) {
      toggleEstimateSelected(String(estimate.id));
      return;
    }
    if (
      isEstimatePanelOpen &&
      (panelMode === 'create' || panelMode === 'edit' || panelMode === 'view')
    ) {
      attemptNavigation(() => {
        closeEstimatePanel();
        setPreviewEstimate(estimate);
      });
      return;
    }
    setPreviewEstimate((current) =>
      current && String(current.id) === String(estimate.id) ? null : estimate,
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
    closeEstimatePanel();
  }, [closeEstimatePanel]);

  const handleInlineFormOnSave = useCallback(
    async (data: Parameters<typeof saveEstimate>[0]) => saveEstimate(data),
    [saveEstimate],
  );

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
          {t('estimates.filter.total', { defaultValue: 'Total' })}{' '}
          <span className="tabular-nums font-semibold">({stats.total})</span>
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
          {t('estimates.filter.draft', { defaultValue: 'Draft' })}{' '}
          <span className="tabular-nums font-semibold">({stats.draft})</span>
        </span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => toggleFilter('sent')}
        className={cn(
          isFilterActive('sent') ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
        )}
      >
        <Send className="h-3.5 w-3.5" />
        <span>
          {t('estimates.filter.sent', { defaultValue: 'Sent' })}{' '}
          <span className="tabular-nums font-semibold">({stats.sent})</span>
        </span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => toggleFilter('accepted')}
        className={cn(
          isFilterActive('accepted') ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
        )}
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        <span>
          {t('estimates.filter.accepted', { defaultValue: 'Accepted' })}{' '}
          <span className="tabular-nums font-semibold">({stats.accepted})</span>
        </span>
      </Button>
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
          aria-label={t('estimates.sort', { defaultValue: 'Sort' })}
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          <span>{t('estimates.sort', { defaultValue: 'Sort' })}</span>
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
          {sortOrder === 'asc'
            ? t('estimates.sortAsc', { defaultValue: 'Ascending' })
            : t('estimates.sortDesc', { defaultValue: 'Descending' })}
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
            {t('estimates.sortAsc', { defaultValue: 'Ascending' })}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="desc"
            className="rounded-md text-xs"
            onSelect={(event) => event.preventDefault()}
          >
            <ArrowDown className="mr-2 h-3.5 w-3.5" />
            {t('estimates.sortDesc', { defaultValue: 'Descending' })}
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
    if (sortedEstimates.length === 0) {
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

  if (estimatesContentView === 'settings') {
    return (
      <div className="plugin-estimates min-h-full bg-background">
        <div className="px-6 py-4">
          <EstimateSettingsView onClose={closeEstimateSettingsView} />
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
                  toolbarCollapsed
                    ? t('estimates.expandToolbar', { defaultValue: 'Show toolbar' })
                    : t('estimates.collapseToolbar', { defaultValue: 'Hide toolbar' })
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
                aria-controls="estimates-mail-toolbar"
                onClick={toggleToolbarCollapsed}
              />
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {toolbarEdgeToggle}
      <div
        ref={pageShellRef}
        className={cn(
          'plugin-estimates flex min-h-0 flex-1 flex-col',
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
                  id="estimates-mail-toolbar"
                  className={cn(
                    'flex flex-wrap items-center justify-between gap-3',
                    toolbarCollapsed && 'pointer-events-none',
                  )}
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                    <h2 className={PLUGIN_PAGE_TITLE_CLASS}>{t('nav.estimates')}</h2>
                    <ExpandableIconButton
                      icon={Settings}
                      label={t('common.settings')}
                      variant="soft"
                      onClick={openEstimateSettings}
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
                      placeholder={t('estimates.searchPlaceholder')}
                    />
                    <ExpandableIconButton
                      icon={Plus}
                      label={t('estimates.addEstimate')}
                      variant="soft"
                      onClick={() => attemptNavigation(() => openEstimatePanel(null))}
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
            itemLabel="estimates"
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
                {sortedEstimates.length === 0 ? (
                  <ListEmptyState
                    message={searchTerm ? t('estimates.noMatch') : t('estimates.noYet')}
                    createLabel={!searchTerm ? t('estimates.addEstimate') : undefined}
                    onCreate={
                      !searchTerm
                        ? () => attemptNavigation(() => openEstimatePanel(null))
                        : undefined
                    }
                  />
                ) : (
                  <EstimateListTable
                    estimates={sortedEstimates}
                    primarySort={primarySort}
                    sortOrder={sortOrder}
                    onSort={handleTableSort}
                    isSelected={isSelected}
                    onRowClick={handleRowActivate}
                    onCheckboxMouseDown={handleRowCheckboxShiftMouseDown}
                    onCheckboxChange={onVisibleRowCheckboxChange}
                    allVisibleSelected={allVisibleSelected}
                    onHeaderCheckboxChange={handleHeaderCheckboxChange}
                    recentlyDuplicatedEstimateId={recentlyDuplicatedEstimateId}
                    selectionEnabled={selectionMode}
                    activeEstimateId={activeListEstimateId}
                    visibleColumnIds={visibleColumnIds}
                  />
                )}

                <ListFooterBar
                  meta={
                    <>
                      Showing {sortedEstimates.length} of {estimates.length} Estimates
                    </>
                  }
                />
              </div>
            </div>

            {showDesktopSplit ? (
              <aside
                className="h-full min-h-0 min-w-0 overflow-y-auto overscroll-contain"
                role="region"
                aria-label={t('estimates.quickContext.title', { defaultValue: 'Quick context' })}
                aria-live="polite"
              >
                {inlineForm ? (
                  <div className="flex min-h-0 flex-col gap-3">
                    <div className="flex shrink-0 justify-end">
                      <InlinePanelFormActions
                        mode={panelMode === 'edit' ? 'edit' : 'create'}
                        hasBlockingErrors={inlineFormHasBlockingErrors}
                        onClose={handleInlineFormClose}
                        onSave={() => {
                          void handleInlineFormSave();
                        }}
                        t={t}
                      />
                    </div>
                    <EstimateForm
                      ref={inlineFormRef}
                      currentEstimate={currentEstimate ?? undefined}
                      onSave={handleInlineFormOnSave}
                      onCancel={closeEstimatePanel}
                      stacked
                    />
                  </div>
                ) : detailEstimate ? (
                  <EstimateView estimate={detailEstimate} stacked />
                ) : (
                  <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'p-4 md:p-6')}>
                    <EstimatesStatisticsView />
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

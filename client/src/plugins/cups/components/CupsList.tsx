import {
  BarChart2,
  Calendar,
  CheckSquare,
  ArrowDown,
  ArrowUp,
  Download,
  Eye,
  LayoutGrid,
  Plus,
  Settings,
  SlidersHorizontal,
  Star,
  Trash2,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useShiftRangeListSelection } from '@/core/hooks/useShiftRangeListSelection';
import {
  useEffectiveCardColumnCount,
  useEffectiveColumnCount,
  useIsEffectiveTableView,
} from '@/core/list/effectiveListViewMode';
import { nextListTableSort } from '@/core/list/listViewMode';
import { BulkActionRoundBar, type BulkActionRoundItem } from '@/core/ui/BulkActionRoundBar';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import { ListColumnLayoutToggle } from '@/core/ui/ListColumnLayoutToggle';
import { ListEmptyState } from '@/core/ui/ListEmptyState';
import {
  LIST_FILTER_AND_SORT_ROW_CLASS,
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
  LIST_FILTER_CHIP_ROW_CLASS,
  LIST_FILTER_CHIP_SLOT_CLASS,
  LIST_FILTER_SORT_CLUSTER_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { ListFooterBar } from '@/core/ui/ListFooterBar';
import { useMobileActions, useRegisterMobileSearch } from '@/core/ui/MobileActionsContext';
import {
  PLUGIN_PAGE_HEADER_ACTIONS_CLASS,
  PLUGIN_PAGE_LIST_SHELL_CLASS,
  PLUGIN_PAGE_SECTION_GAP_CLASS,
  PLUGIN_PAGE_TITLE_CLASS,
  PLUGIN_PAGE_TITLE_ROW_CLASS,
} from '@/core/ui/pluginPageStyles';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';
import { ingestApi } from '@/plugins/ingest/api/ingestApi';
import type { IngestSource } from '@/plugins/ingest/types/ingest';

import { useCups } from '../hooks/useCups';
import {
  CUPS_COLUMN_COUNT_STORAGE_KEY,
  CUPS_SETTINGS_KEY,
  getInitialCupColumnCount,
  resolveCupColumnCount,
  type CupColumnCount,
} from '../utils/cupColumnCount';
import {
  cupMatchesListFilters,
  toggleCupListFilter,
  type CupListFilter,
  type CupListFilterSelection,
} from '../utils/cupListFilter';
import {
  compareCupsByField,
  isCupAscDefaultField,
  type CupSortField,
  type CupSortOrder,
} from '../utils/cupListSort';
import {
  getInitialCupListViewMode,
  persistCupListViewModeSession,
  resolveCupListViewMode,
  type CupListViewMode,
} from '../utils/cupListViewMode';
import { resolveVisibleCupTableColumns, type CupTableColumnId } from '../utils/cupTableColumns';

import { BulkPropertiesDialog } from './BulkPropertiesDialog';
import {
  CupIngestImportResultDialog,
  type CupIngestImportResultVariant,
} from './CupIngestImportResultDialog';
import { CupIngestPickSourceDialog } from './CupIngestPickSourceDialog';
import { CupListItem } from './CupListItem';
import { CupListTable } from './CupListTable';
import { CupsSettingsView, type CupsSettingsCategory } from './CupsSettingsView';
import { CupsStatisticsView } from './CupsStatisticsView';

type SortField = CupSortField;
type SortOrder = CupSortOrder;

const SORT_FIELD_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'updatedAt', label: 'Updated' },
  { value: 'name', label: 'Name' },
  { value: 'start_date', label: 'Start date' },
  { value: 'location', label: 'Location' },
  { value: 'ingest', label: 'Ingest' },
  { value: 'featured', label: 'Featured' },
  { value: 'ratings_count', label: 'Ratings' },
  { value: 'visible', label: 'Visible' },
];

export function CupsList() {
  const { t } = useTranslation();
  const {
    cups,
    cupsContentView,
    openCupPanel,
    openCupSettings,
    closeCupSettingsView,
    openCupStatistics,
    closeCupStatisticsView,
    openCupForView,
    selectedCupIds,
    selectAllCups,
    mergeIntoCupSelection,
    clearCupSelection,
    isSelected,
    toggleCupSelected,
    deleteCups,
    selectedCount,
    importFromIngestSource,
    refreshCups,
  } = useCups();
  const { getSettings, updateSettings, settingsVersion } = useApp();
  const { attemptNavigation } = useGlobalNavigationGuard();

  useMobileActions({
    onAdd: () => attemptNavigation(() => openCupPanel(null)),
    onSettings: openCupSettings,
  });

  const [search, setSearch] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);

  useRegisterMobileSearch({
    value: search,
    onChange: setSearch,
    placeholder: t('cups.searchPlaceholder', { count: cups.length }),
  });

  const [primarySort, setPrimarySort] = useState<SortField>('updatedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [columnCount, setColumnCountState] = useState<CupColumnCount>(getInitialCupColumnCount);
  const [listViewMode, setListViewModeState] = useState<CupListViewMode>(getInitialCupListViewMode);
  const [visibleColumnIds, setVisibleColumnIds] = useState<CupTableColumnId[]>(() =>
    resolveVisibleCupTableColumns(null),
  );
  const [activeFilters, setActiveFilters] = useState<CupListFilterSelection>([]);
  const [settingsCategory, setSettingsCategory] = useState<CupsSettingsCategory>('columns');
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showBulkPropertiesDialog, setShowBulkPropertiesDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pickImportOpen, setPickImportOpen] = useState(false);
  const [pickImportSettings, setPickImportSettings] = useState<{
    allowedIds: string[];
    defaultId: string;
  }>({
    allowedIds: [],
    defaultId: '',
  });
  const [importRunning, setImportRunning] = useState(false);
  const [importResultOpen, setImportResultOpen] = useState(false);
  const [importResult, setImportResult] = useState<{
    variant: CupIngestImportResultVariant;
    parsed: number;
    created: number;
    updated: number;
    skipped: number;
    softDeleted: number;
    restored: number;
    hardDeleted: number;
    errors: string[];
    sourceCount?: number;
  } | null>(null);
  const [ingestSources, setIngestSources] = useState<IngestSource[]>([]);

  const selectedCups = useMemo(
    () => cups.filter((c) => selectedCupIds.includes(c.id)),
    [cups, selectedCupIds],
  );

  useEffect(() => {
    let cancelled = false;
    ingestApi
      .getSources()
      .then((sources) => {
        if (!cancelled) {
          setIngestSources(sources);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const ingestTitleBySourceId = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of ingestSources) {
      m.set(String(s.id), s.name);
    }
    return m;
  }, [ingestSources]);

  const ingestTitleForCup = useCallback(
    (ingestSourceId: string | null | undefined) => {
      if (ingestSourceId === null || ingestSourceId === undefined || ingestSourceId === '') {
        return '';
      }
      return ingestTitleBySourceId.get(String(ingestSourceId)) ?? '';
    },
    [ingestTitleBySourceId],
  );

  useEffect(() => {
    let cancelled = false;
    getSettings(CUPS_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        const resolved = resolveCupColumnCount(settings);
        const next = (resolved === 1 || resolved === 2 ? 3 : resolved) as CupColumnCount;
        setColumnCountState(next);
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(CUPS_COLUMN_COUNT_STORAGE_KEY, String(next));
        }
        if (next !== resolved) {
          updateSettings(CUPS_SETTINGS_KEY, { columnCount: next }).catch(() => {});
        }
        const nextView = resolveCupListViewMode(settings);
        setListViewModeState(nextView);
        persistCupListViewModeSession(nextView);
        setVisibleColumnIds(resolveVisibleCupTableColumns(settings));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  const setColumnCount = useCallback(
    (_count: CupColumnCount) => {
      const next = 3 as CupColumnCount;
      setColumnCountState(next);
      setListViewModeState('cards');
      persistCupListViewModeSession('cards');
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(CUPS_COLUMN_COUNT_STORAGE_KEY, String(next));
      }
      updateSettings(CUPS_SETTINGS_KEY, { columnCount: next, listViewMode: 'cards' }).catch(
        () => {},
      );
    },
    [updateSettings],
  );

  const setListViewMode = useCallback(
    (mode: CupListViewMode) => {
      setListViewModeState(mode);
      persistCupListViewModeSession(mode);
      updateSettings(CUPS_SETTINGS_KEY, { listViewMode: mode }).catch(() => {});
    },
    [updateSettings],
  );

  const handlePrimarySortChange = (field: SortField) => {
    setPrimarySort(field);
    setSortOrder(isCupAscDefaultField(field) ? 'asc' : 'desc');
  };

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const handleTableSort = useCallback(
    (field: SortField) => {
      const next = nextListTableSort(primarySort, sortOrder, field, isCupAscDefaultField);
      setPrimarySort(next.field);
      setSortOrder(next.order);
    },
    [primarySort, sortOrder],
  );

  const isTableView = useIsEffectiveTableView(listViewMode);
  const effectiveColumnCount = useEffectiveColumnCount(columnCount);
  const effectiveCardColumnCount = useEffectiveCardColumnCount(columnCount);

  const filtered = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartMs = todayStart.getTime();

    const byFilter = cups.filter((c) => cupMatchesListFilters(c, activeFilters, todayStartMs));

    const q = search.trim().toLowerCase();
    if (!q) {
      return byFilter;
    }
    return byFilter.filter((c) => {
      const ingestTitle = ingestTitleForCup(c.ingest_source_id);
      return [c.name, c.organizer, c.location, c.categories, ingestTitle]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [cups, search, ingestTitleForCup, activeFilters]);

  const isFilterActive = (filter: CupListFilter) => activeFilters.includes(filter);
  const toggleFilter = (filter: CupListFilter) => {
    setActiveFilters((prev) => toggleCupListFilter(prev, filter));
  };

  const filteredAndSorted = useMemo(() => {
    return [...filtered].sort((a, b) =>
      compareCupsByField(a, b, primarySort, sortOrder, ingestTitleForCup),
    );
  }, [filtered, primarySort, sortOrder, ingestTitleForCup]);

  const stats = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartMs = todayStart.getTime();
    const active = cups.filter((c) => c.deleted_at === null || c.deleted_at === undefined);
    return {
      total: active.length,
      visible: active.filter((c) => Boolean(c.visible)).length,
      featured: active.filter((c) => Boolean(c.featured)).length,
      upcoming: active.filter((c) => {
        if (!c.start_date) {
          return false;
        }
        const startDateMs = new Date(c.start_date).getTime();
        return Number.isFinite(startDateMs) && startDateMs >= todayStartMs;
      }).length,
      removed: cups.filter((c) => c.deleted_at !== null && c.deleted_at !== undefined).length,
    };
  }, [cups]);

  const visibleIds = useMemo(() => filteredAndSorted.map((c) => c.id), [filteredAndSorted]);

  const allVisibleSelected = useMemo(
    () => visibleIds.length > 0 && visibleIds.every((id) => isSelected(id)),
    [visibleIds, isSelected],
  );

  const handleHeaderCheckboxChange = () => {
    if (allVisibleSelected) {
      clearCupSelection();
    } else {
      const union = Array.from(new Set([...selectedCupIds, ...visibleIds]));
      selectAllCups(union);
    }
  };

  const { handleRowCheckboxShiftMouseDown, onVisibleRowCheckboxChange } =
    useShiftRangeListSelection({
      orderedVisibleIds: visibleIds,
      mergeIntoSelection: mergeIntoCupSelection,
      toggleOne: toggleCupSelected,
    });

  const handleBulkDelete = async () => {
    if (selectedCupIds.length === 0) {
      return;
    }
    setDeleting(true);
    try {
      await deleteCups(selectedCupIds);
      setShowBulkDeleteModal(false);
    } catch (err: any) {
      console.error('Bulk delete failed:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleEnterSelectionMode = () => {
    setSelectionMode(true);
  };

  const handleExitSelectionMode = () => {
    clearCupSelection();
    setSelectionMode(false);
  };

  const handleRowActivate = (cup: (typeof cups)[0]) => {
    if (selectionMode) {
      toggleCupSelected(cup.id);
      return;
    }
    attemptNavigation(() => openCupForView(cup));
  };

  const bulkRoundActions = useMemo((): BulkActionRoundItem[] => {
    const disabled = selectedCount === 0;
    return [
      {
        key: 'properties',
        label: t('slots.properties'),
        icon: SlidersHorizontal,
        disabled,
        onClick: () => setShowBulkPropertiesDialog(true),
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
  }, [selectedCount, t]);

  const openImportPicker = useCallback(async () => {
    const settings = await getSettings('cups').catch(
      () => ({}) as { defaultIngestSourceId?: string; allowedIngestSourceIds?: string[] },
    );
    const allowedIds = Array.isArray(settings?.allowedIngestSourceIds)
      ? settings.allowedIngestSourceIds.map(String)
      : [];
    const defaultId = String(settings?.defaultIngestSourceId || '');
    setPickImportSettings({ allowedIds, defaultId });
    setPickImportOpen(true);
  }, [getSettings]);

  const handleConfirmImportFromList = useCallback(
    async (sourceId: string) => {
      const allowedIds = pickImportSettings.allowedIds;
      if (allowedIds.length > 0 && !allowedIds.includes(String(sourceId))) {
        setPickImportOpen(false);
        setImportResult({
          variant: 'error',
          parsed: 0,
          created: 0,
          updated: 0,
          skipped: 0,
          softDeleted: 0,
          restored: 0,
          hardDeleted: 0,
          errors: ['This ingest source is not enabled for Cups. Enable it in Cups settings.'],
          sourceCount: 1,
        });
        setImportResultOpen(true);
        return;
      }
      setImportRunning(true);
      try {
        const result = await importFromIngestSource(sourceId);
        const errs = Array.isArray(result.errors) ? result.errors.map(String) : [];
        const variant: CupIngestImportResultVariant =
          errs.length > 0 &&
          (result.created ?? 0) === 0 &&
          (result.updated ?? 0) === 0 &&
          (result.parsed ?? 0) === 0
            ? 'error'
            : errs.length > 0
              ? 'partial'
              : 'success';
        setPickImportOpen(false);
        setImportResult({
          variant,
          parsed: result.parsed ?? 0,
          created: result.created ?? 0,
          updated: result.updated ?? 0,
          skipped: result.skipped ?? 0,
          softDeleted: result.softDeleted ?? 0,
          restored: result.restored ?? 0,
          hardDeleted: result.hardDeleted ?? 0,
          errors: errs,
          sourceCount: 1,
        });
        setImportResultOpen(true);
      } catch (error: any) {
        setPickImportOpen(false);
        setImportResult({
          variant: 'error',
          parsed: 0,
          created: 0,
          updated: 0,
          skipped: 0,
          softDeleted: 0,
          restored: 0,
          hardDeleted: 0,
          errors: [error?.message || 'Import failed'],
          sourceCount: 1,
        });
        setImportResultOpen(true);
      } finally {
        setImportRunning(false);
      }
    },
    [importFromIngestSource, pickImportSettings.allowedIds],
  );

  if (cupsContentView === 'settings') {
    return (
      <div className="plugin-cups min-h-full bg-background">
        <div className="px-6 py-4">
          <CupsSettingsView
            selectedCategory={settingsCategory}
            onSelectedCategoryChange={setSettingsCategory}
            renderCategoryButtonsInline
            onClose={closeCupSettingsView}
          />
        </div>
      </div>
    );
  }

  if (cupsContentView === 'statistics') {
    return (
      <div className="plugin-cups min-h-full bg-background">
        <div className="px-6 py-4">
          <CupsStatisticsView onClose={closeCupStatisticsView} />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('plugin-cups', PLUGIN_PAGE_LIST_SHELL_CLASS)}>
      <div className={PLUGIN_PAGE_SECTION_GAP_CLASS}>
        <div className="hidden md:block">
          <div className="flex items-start justify-between gap-6">
            <div className="flex min-w-0 flex-1 flex-col gap-5">
              <div className="min-w-0">
                <div className={PLUGIN_PAGE_TITLE_ROW_CLASS}>
                  <h2 className={PLUGIN_PAGE_TITLE_CLASS}>{t('nav.cups')}</h2>
                  <ExpandableIconButton
                    icon={Download}
                    label={t('cups.importFromIngest')}
                    variant="soft"
                    onClick={openImportPicker}
                  />
                  <ExpandableIconButton
                    icon={BarChart2}
                    label={t('common.statistics')}
                    variant="soft"
                    onClick={() => openCupStatistics()}
                  />
                  <ExpandableIconButton
                    icon={Settings}
                    label={t('common.settings')}
                    variant="soft"
                    onClick={openCupSettings}
                  />
                  {filteredAndSorted.length > 0 ? (
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
                value={search}
                onChange={setSearch}
                placeholder={t('cups.searchPlaceholder', { count: cups.length })}
              />
              <ListColumnLayoutToggle
                columnCount={columnCount}
                listViewMode={listViewMode}
                onSelectColumns={setColumnCount}
                onSelectTable={() => setListViewMode('table')}
                columnAriaLabel={(count) => t(`cups.columns${count}`)}
                tableAriaLabel={t('common.tableView')}
              />
              <ExpandableIconButton
                icon={Plus}
                label={t('cups.addCup')}
                variant="soft"
                alwaysExpanded
                onClick={() => attemptNavigation(() => openCupPanel(null))}
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
              onClick={() => toggleFilter('visible')}
              className={cn(
                isFilterActive('visible') ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
              )}
            >
              <Eye className="h-3.5 w-3.5" />
              <span>
                Visible <span className="tabular-nums font-semibold">({stats.visible})</span>
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => toggleFilter('featured')}
              className={cn(
                isFilterActive('featured') ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
              )}
            >
              <Star className="h-3.5 w-3.5" />
              <span>
                Featured <span className="tabular-nums font-semibold">({stats.featured})</span>
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => toggleFilter('upcoming')}
              className={cn(
                isFilterActive('upcoming') ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
              )}
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>
                Upcoming <span className="tabular-nums font-semibold">({stats.upcoming})</span>
              </span>
            </Button>
            {stats.removed > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => toggleFilter('removed')}
                className={cn(
                  isFilterActive('removed')
                    ? LIST_FILTER_CHIP_ACTIVE_CLASS
                    : LIST_FILTER_CHIP_CLASS,
                )}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>
                  Removed <span className="tabular-nums font-semibold">({stats.removed})</span>
                </span>
              </Button>
            ) : null}
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

        <BulkDeleteModal
          isOpen={showBulkDeleteModal}
          onClose={() => setShowBulkDeleteModal(false)}
          onConfirm={handleBulkDelete}
          itemCount={selectedCount}
          itemLabel={selectedCount === 1 ? 'cup' : 'cups'}
          isLoading={deleting}
        />

        <BulkPropertiesDialog
          isOpen={showBulkPropertiesDialog}
          onClose={() => setShowBulkPropertiesDialog(false)}
          selectedCups={selectedCups}
          onSuccess={async () => {
            await refreshCups();
            clearCupSelection();
          }}
        />

        <CupIngestPickSourceDialog
          isOpen={pickImportOpen}
          onOpenChange={setPickImportOpen}
          allowedIngestSourceIds={pickImportSettings.allowedIds}
          defaultSourceId={pickImportSettings.defaultId}
          onConfirm={handleConfirmImportFromList}
          confirming={importRunning}
        />

        {importResult && (
          <CupIngestImportResultDialog
            isOpen={importResultOpen}
            onClose={() => {
              setImportResultOpen(false);
              setImportResult(null);
            }}
            variant={importResult.variant}
            sourceCount={importResult.sourceCount}
            parsed={importResult.parsed}
            created={importResult.created}
            updated={importResult.updated}
            skipped={importResult.skipped}
            softDeleted={importResult.softDeleted}
            restored={importResult.restored}
            hardDeleted={importResult.hardDeleted}
            errors={importResult.errors}
          />
        )}

        <div className="flex flex-col gap-3">
          {filteredAndSorted.length === 0 ? (
            <ListEmptyState
              message={search.trim() ? t('cups.noMatch') : t('cups.noYet')}
              createLabel={!search.trim() ? t('cups.addCup') : undefined}
              onCreate={
                !search.trim() ? () => attemptNavigation(() => openCupPanel(null)) : undefined
              }
            />
          ) : isTableView ? (
            <CupListTable
              cups={filteredAndSorted}
              primarySort={primarySort}
              sortOrder={sortOrder}
              onSort={handleTableSort}
              ingestTitleForCup={ingestTitleForCup}
              isSelected={isSelected}
              onRowClick={handleRowActivate}
              onCheckboxMouseDown={handleRowCheckboxShiftMouseDown}
              onCheckboxChange={onVisibleRowCheckboxChange}
              allVisibleSelected={allVisibleSelected}
              onHeaderCheckboxChange={handleHeaderCheckboxChange}
              selectionEnabled={selectionMode}
              visibleColumnIds={visibleColumnIds}
            />
          ) : (
            <div
              className={cn(
                'grid gap-3',
                effectiveColumnCount === 1 && 'grid-cols-1',
                effectiveColumnCount === 2 && 'grid-cols-1 sm:grid-cols-2',
                effectiveColumnCount === 3 && 'grid-cols-1 sm:grid-cols-3',
              )}
            >
              {filteredAndSorted.map((cup, index) => (
                <CupListItem
                  key={cup.id}
                  cup={cup}
                  selected={isSelected(cup.id)}
                  onClick={() => handleRowActivate(cup)}
                  ingestTitle={ingestTitleForCup(cup.ingest_source_id) || null}
                  columnCount={effectiveCardColumnCount}
                  checkbox={
                    selectionMode ? (
                      <input
                        type="checkbox"
                        checked={isSelected(cup.id)}
                        onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                        onChange={() => onVisibleRowCheckboxChange(cup.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 cursor-pointer"
                        aria-label={isSelected(cup.id) ? 'Unselect cup' : 'Select cup'}
                      />
                    ) : undefined
                  }
                />
              ))}
            </div>
          )}

          <ListFooterBar
            meta={
              <>
                Showing {filteredAndSorted.length} of {cups.length} Cups
              </>
            }
          />
        </div>
      </div>
    </div>
  );
}

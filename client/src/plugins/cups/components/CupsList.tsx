import {
  ArrowDown,
  ArrowUp,
  Download,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useApp } from '@/core/api/AppContext';
import { useShiftRangeListSelection } from '@/core/hooks/useShiftRangeListSelection';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import { ListFilterStatCard } from '@/core/ui/ListFilterStatCard';
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
  compareCupsTwoLevel,
  isCupAscDefaultField,
  type CupSortField,
  type CupSortOrder,
} from '../utils/cupListSort';

import { BulkPropertiesDialog } from './BulkPropertiesDialog';
import { CupListItem } from './CupListItem';
import {
  CupIngestImportResultDialog,
  type CupIngestImportResultVariant,
} from './CupIngestImportResultDialog';
import { CupIngestPickSourceDialog } from './CupIngestPickSourceDialog';
import { CupsSettingsView, type CupsSettingsCategory } from './CupsSettingsView';

type SortField = CupSortField;
type SortOrder = CupSortOrder;
type CupFilter = 'all' | 'visible' | 'featured' | 'upcoming' | 'removed';

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

const COLUMN_OPTIONS: CupColumnCount[] = [1, 2, 3];

export function CupsList() {
  const { t } = useTranslation();
  const {
    cups,
    cupsContentView,
    openCupPanel,
    openCupSettings,
    closeCupSettingsView,
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

  const [search, setSearch] = useState('');
  const [primarySort, setPrimarySort] = useState<SortField>('updatedAt');
  const [secondarySort, setSecondarySort] = useState<SortField | ''>('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [columnCount, setColumnCountState] = useState<CupColumnCount>(getInitialCupColumnCount);
  const [activeFilter, setActiveFilter] = useState<CupFilter>('all');
  const [settingsCategory, setSettingsCategory] = useState<CupsSettingsCategory>('view');
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
    hardDeleted: number;
    errors: string[];
    sourceCount?: number;
  } | null>(null);
  const [ingestSources, setIngestSources] = useState<IngestSource[]>([]);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

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
        const next = resolveCupColumnCount(settings);
        setColumnCountState(next);
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(CUPS_COLUMN_COUNT_STORAGE_KEY, String(next));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  const setColumnCount = useCallback(
    (count: CupColumnCount) => {
      setColumnCountState(count);
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(CUPS_COLUMN_COUNT_STORAGE_KEY, String(count));
      }
      updateSettings(CUPS_SETTINGS_KEY, { columnCount: count }).catch(() => {});
    },
    [updateSettings],
  );

  const handlePrimarySortChange = (field: SortField) => {
    setPrimarySort(field);
    setSortOrder(isCupAscDefaultField(field) ? 'asc' : 'desc');
    setSecondarySort((prev) => (prev === field ? '' : prev));
  };

  const handleSecondarySortChange = (value: string) => {
    if (value === '' || value === 'none') {
      setSecondarySort('');
      return;
    }
    const field = value as SortField;
    if (field === primarySort) {
      return;
    }
    setSecondarySort(field);
  };

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const secondarySortOptions = useMemo(
    () => SORT_FIELD_OPTIONS.filter((option) => option.value !== primarySort),
    [primarySort],
  );

  const primarySortOptions = useMemo(
    () =>
      secondarySort
        ? SORT_FIELD_OPTIONS.filter((option) => option.value !== secondarySort)
        : SORT_FIELD_OPTIONS,
    [secondarySort],
  );

  const filtered = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartMs = todayStart.getTime();

    const byFilter = cups.filter((c) => {
      if (activeFilter === 'removed') {
        return c.deleted_at !== null && c.deleted_at !== undefined;
      }
      if (c.deleted_at !== null && c.deleted_at !== undefined) {
        return false;
      }
      if (activeFilter === 'visible') {
        return Boolean(c.visible);
      }
      if (activeFilter === 'featured') {
        return Boolean(c.featured);
      }
      if (activeFilter === 'upcoming') {
        if (!c.start_date) {
          return false;
        }
        const startDateMs = new Date(c.start_date).getTime();
        return Number.isFinite(startDateMs) && startDateMs >= todayStartMs;
      }
      return true;
    });

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
  }, [cups, search, ingestTitleForCup, activeFilter]);

  const filteredAndSorted = useMemo(() => {
    return [...filtered].sort((a, b) =>
      compareCupsTwoLevel(a, b, primarySort, secondarySort, sortOrder, ingestTitleForCup),
    );
  }, [filtered, primarySort, secondarySort, sortOrder, ingestTitleForCup]);

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

  const someVisibleSelected = useMemo(
    () => visibleIds.some((id) => isSelected(id)),
    [visibleIds, isSelected],
  );

  useEffect(() => {
    if (!headerCheckboxRef.current) {
      return;
    }
    headerCheckboxRef.current.indeterminate = !allVisibleSelected && someVisibleSelected;
  }, [allVisibleSelected, someVisibleSelected]);

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
            inlineTrailing={
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={X}
                className="h-9 px-3 text-xs"
                onClick={closeCupSettingsView}
              >
                {t('common.close')}
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="plugin-cups min-h-full bg-background px-6 py-4">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold tracking-tight">{t('nav.cups')}</h2>
            <p className="text-sm text-muted-foreground">{t('cups.listDescription')}</p>
          </div>
          <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              icon={Download}
              className="h-9 px-3 text-xs"
              onClick={openImportPicker}
            >
              {t('cups.importFromIngest')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={Settings}
              className="h-9 px-2.5 text-xs"
              onClick={openCupSettings}
              title={t('common.settings')}
            >
              {t('common.settings')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              className="h-9 px-3 text-xs"
              onClick={() => attemptNavigation(() => openCupPanel(null))}
            >
              {t('cups.addCup')}
            </Button>
          </div>
        </div>

        <div
          className={cn(
            'grid grid-cols-2 gap-3',
            stats.removed > 0 ? 'md:grid-cols-5' : 'md:grid-cols-4',
          )}
        >
          <ListFilterStatCard
            label="Total"
            value={stats.total}
            dotClassName="bg-blue-500"
            active={activeFilter === 'all'}
            onClick={() => setActiveFilter('all')}
          />
          <ListFilterStatCard
            label="Visible"
            value={stats.visible}
            dotClassName="bg-emerald-500"
            active={activeFilter === 'visible'}
            onClick={() => setActiveFilter('visible')}
          />
          <ListFilterStatCard
            label="Featured"
            value={stats.featured}
            dotClassName="bg-amber-500"
            active={activeFilter === 'featured'}
            onClick={() => setActiveFilter('featured')}
          />
          <ListFilterStatCard
            label="Upcoming"
            value={stats.upcoming}
            dotClassName="bg-violet-500"
            active={activeFilter === 'upcoming'}
            onClick={() => setActiveFilter('upcoming')}
          />
          {stats.removed > 0 && (
            <ListFilterStatCard
              label="Removed"
              value={stats.removed}
              dotClassName="bg-red-400"
              active={activeFilter === 'removed'}
              onClick={() => setActiveFilter('removed')}
            />
          )}
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
            hardDeleted={importResult.hardDeleted}
            errors={importResult.errors}
          />
        )}

        <div className="flex flex-col gap-3">
          {/* Toolbar: search + two-level sort + asc/desc + columns */}
          <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-4 py-3 shadow-sm dark:bg-slate-950">
            <div className="relative w-full max-w-sm md:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('cups.searchPlaceholder', { count: cups.length })}
                className="h-8 bg-background pl-9 text-xs"
              />
            </div>
            <div className="flex flex-shrink-0 items-center gap-1">
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
                    {primarySortOptions.map((option) => (
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
                <Select value={secondarySort || 'none'} onValueChange={handleSecondarySortChange}>
                  <SelectTrigger
                    className="h-7 w-[140px] rounded-md border-border/30 bg-background px-2 text-xs shadow-none"
                    aria-label="And sort by"
                  >
                    <SelectValue placeholder="And..." />
                  </SelectTrigger>
                  <SelectContent
                    position="item-aligned"
                    className="rounded-xl border-border/50 shadow-xl"
                  >
                    <SelectItem value="none" className="rounded-md text-xs">
                      And...
                    </SelectItem>
                    {secondarySortOptions.map((option) => (
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
              <div className="inline-flex items-center rounded-md border border-border/30 bg-muted/40 p-0.5">
                {COLUMN_OPTIONS.map((count) => (
                  <Button
                    key={count}
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={cn(
                      'h-7 min-w-7 rounded-[6px] px-2 text-xs',
                      columnCount === count
                        ? 'bg-background text-foreground shadow-sm hover:bg-background'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                    onClick={() => setColumnCount(count)}
                    aria-label={t(`cups.columns${count}`)}
                    aria-pressed={columnCount === count}
                  >
                    {count}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Select-all / bulk action bar */}
          {filteredAndSorted.length > 0 ? (
            <div className="flex min-h-[3.75rem] flex-wrap items-center gap-2 rounded-xl bg-white px-4 py-3 shadow-sm dark:bg-slate-950">
              {selectedCount === 0 ? (
                <div className="flex h-9 min-w-0 items-center gap-2">
                  <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={handleHeaderCheckboxChange}
                    className="h-4 w-4 cursor-pointer"
                    aria-label="Select all cups"
                  />
                  <span className="text-xs text-muted-foreground">Select all</span>
                </div>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={XCircle}
                    className="h-9 px-3 text-xs text-red-600 underline decoration-red-600/50 hover:bg-red-50 hover:text-red-700 hover:decoration-red-700 dark:text-red-400 dark:decoration-red-400/50 dark:hover:bg-red-950/30 dark:hover:text-red-300"
                    onClick={clearCupSelection}
                    type="button"
                  >
                    {t('common.clearSelection')}
                  </Button>
                  <span className="inline-flex h-9 items-center rounded-md border border-blue-200 bg-blue-50 px-2 text-[10px] font-medium text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
                    {t('bulk.selected', { count: selectedCount })}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={SlidersHorizontal}
                    onClick={() => setShowBulkPropertiesDialog(true)}
                    className="h-9 px-3 text-xs text-foreground underline decoration-border hover:bg-primary/10 hover:text-primary hover:decoration-primary"
                  >
                    {t('slots.properties')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Trash2}
                    onClick={() => setShowBulkDeleteModal(true)}
                    className="h-9 px-3 text-xs text-red-600 underline decoration-red-600/50 hover:bg-red-50 hover:text-red-700 hover:decoration-red-700 dark:text-red-400 dark:decoration-red-400/50 dark:hover:bg-red-950/30 dark:hover:text-red-300"
                  >
                    {t('common.delete')}
                  </Button>
                </>
              )}
            </div>
          ) : null}

          {filteredAndSorted.length === 0 ? (
            <div className="rounded-xl bg-white px-4 py-6 text-center text-muted-foreground shadow-sm dark:bg-slate-950">
              {search.trim() ? t('cups.noMatch') : t('cups.noYet')}
            </div>
          ) : (
            <div
              className={cn(
                'grid gap-3',
                columnCount === 1 && 'grid-cols-1',
                columnCount === 2 && 'grid-cols-1 sm:grid-cols-2',
                columnCount === 3 && 'grid-cols-1 sm:grid-cols-3',
              )}
            >
              {filteredAndSorted.map((cup, index) => (
                <CupListItem
                  key={cup.id}
                  cup={cup}
                  selected={isSelected(cup.id)}
                  onClick={() => attemptNavigation(() => openCupForView(cup))}
                  ingestTitle={ingestTitleForCup(cup.ingest_source_id) || null}
                  checkbox={
                    <input
                      type="checkbox"
                      checked={isSelected(cup.id)}
                      onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                      onChange={() => onVisibleRowCheckboxChange(cup.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 cursor-pointer"
                      aria-label={isSelected(cup.id) ? 'Unselect cup' : 'Select cup'}
                    />
                  }
                />
              ))}
            </div>
          )}

          <div className="rounded-xl bg-white px-4 py-3 text-xs text-muted-foreground shadow-sm dark:bg-slate-950">
            Showing {filteredAndSorted.length} of{' '}
            {activeFilter === 'removed' ? stats.removed : stats.total} Cups
          </div>
        </div>
      </div>
    </div>
  );
}

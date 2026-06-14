import {
  ArrowDown,
  ArrowUp,
  Download,
  Grid3x3,
  List,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useApp } from '@/core/api/AppContext';
import { useShiftRangeListSelection } from '@/core/hooks/useShiftRangeListSelection';
import { BulkActionBar } from '@/core/ui/BulkActionBar';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';
import { ingestApi } from '@/plugins/ingest/api/ingestApi';
import type { IngestSource } from '@/plugins/ingest/types/ingest';

import { useCups } from '../hooks/useCups';

import { BulkPropertiesDialog } from './BulkPropertiesDialog';
import { CupCard } from './CupCard';
import {
  CupIngestImportResultDialog,
  type CupIngestImportResultVariant,
} from './CupIngestImportResultDialog';
import { CupIngestPickSourceDialog } from './CupIngestPickSourceDialog';
import { CupsSettingsView, type CupsSettingsCategory } from './CupsSettingsView';

type SortField =
  | 'name'
  | 'start_date'
  | 'location'
  | 'updated_at'
  | 'ingest'
  | 'featured'
  | 'ratings_count';
type SortOrder = 'asc' | 'desc';
type CupsViewMode = 'grid' | 'list';
type CupFilter = 'all' | 'visible' | 'featured' | 'upcoming' | 'removed';

const CUPS_VIEW_MODE_STORAGE_KEY = 'cups:viewMode';

function StatCard({
  label,
  value,
  dotClassName,
  active = false,
  onClick,
}: {
  label: string;
  value: number;
  dotClassName: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <Card
      className={cn(
        'rounded-xl border-0 bg-card p-4 shadow-sm transition-colors',
        onClick && 'cursor-pointer hover:bg-muted/50',
        active && 'ring-1 ring-border/70',
      )}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">
        <span className={cn('h-1.5 w-1.5 rounded-full', dotClassName)} aria-hidden />
        <span>{label}</span>
      </div>
      <div className="text-2xl font-semibold tracking-tight text-foreground">{value}</div>
    </Card>
  );
}

function SortableHead({
  label,
  field,
  sortField,
  sortOrder,
  className,
  onSort,
}: {
  label: string;
  field: SortField;
  sortField: SortField;
  sortOrder: SortOrder;
  className?: string;
  onSort: (field: SortField) => void;
}) {
  return (
    <TableHead
      className={cn('cursor-pointer select-none py-1.5 text-xs hover:bg-muted/50', className)}
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1.5">
        <span>{label}</span>
        {sortField === field &&
          (sortOrder === 'asc' ? (
            <ArrowUp className="h-3 w-3 shrink-0" />
          ) : (
            <ArrowDown className="h-3 w-3 shrink-0" />
          ))}
      </div>
    </TableHead>
  );
}

function getInitialViewMode(): CupsViewMode {
  if (typeof window === 'undefined') {
    return 'list';
  }
  return window.sessionStorage.getItem(CUPS_VIEW_MODE_STORAGE_KEY) === 'grid' ? 'grid' : 'list';
}

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
  const [sortField, setSortField] = useState<SortField>('updated_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [activeFilter, setActiveFilter] = useState<CupFilter>('all');
  const [viewMode, setViewModeState] = useState<CupsViewMode>(getInitialViewMode);
  const [settingsCategory, setSettingsCategory] = useState<CupsSettingsCategory>('view');
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showBulkPropertiesDialog, setShowBulkPropertiesDialog] = useState(false);
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
    getSettings('cups')
      .then((settings: { viewMode?: CupsViewMode }) => {
        if (!cancelled) {
          const nextMode: CupsViewMode = settings?.viewMode === 'grid' ? 'grid' : 'list';
          setViewModeState(nextMode);
          if (typeof window !== 'undefined') {
            window.sessionStorage.setItem(CUPS_VIEW_MODE_STORAGE_KEY, nextMode);
          }
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  const setViewMode = useCallback(
    (mode: CupsViewMode) => {
      setViewModeState(mode);
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(CUPS_VIEW_MODE_STORAGE_KEY, mode);
      }
      updateSettings('cups', { viewMode: mode }).catch(() => {});
    },
    [updateSettings],
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
    const list = [...filtered];
    return list.sort((a, b) => {
      let av: string | number = '';
      let bv: string | number = '';
      if (sortField === 'name') {
        av = (a.name || '').toLowerCase();
        bv = (b.name || '').toLowerCase();
      } else if (sortField === 'location') {
        av = (a.location || '').toLowerCase();
        bv = (b.location || '').toLowerCase();
      } else if (sortField === 'start_date') {
        av = a.start_date ? new Date(a.start_date).getTime() : 0;
        bv = b.start_date ? new Date(b.start_date).getTime() : 0;
      } else if (sortField === 'ingest') {
        const ta = ingestTitleForCup(a.ingest_source_id);
        const tb = ingestTitleForCup(b.ingest_source_id);
        const emptyA = !a.ingest_source_id || ta === '';
        const emptyB = !b.ingest_source_id || tb === '';
        if (emptyA !== emptyB) {
          return sortOrder === 'asc' ? (emptyA ? 1 : -1) : emptyA ? -1 : 1;
        }
        av = ta.toLowerCase();
        bv = tb.toLowerCase();
      } else if (sortField === 'featured') {
        av = a.featured === true ? 1 : 0;
        bv = b.featured === true ? 1 : 0;
      } else if (sortField === 'ratings_count') {
        av = a.ratings_count ?? 0;
        bv = b.ratings_count ?? 0;
      } else {
        av = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        bv = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      }

      if (typeof av === 'number' && typeof bv === 'number') {
        return sortOrder === 'asc' ? av - bv : bv - av;
      }
      const cmp = String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' });
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortField, sortOrder, ingestTitleForCup]);
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
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => isSelected(id));
  const someVisibleSelected = visibleIds.some((id) => isSelected(id));

  useEffect(() => {
    if (!headerCheckboxRef.current) {
      return;
    }
    headerCheckboxRef.current.indeterminate = !allVisibleSelected && someVisibleSelected;
  }, [allVisibleSelected, someVisibleSelected]);

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

  const onToggleAllVisible = useCallback(() => {
    if (allVisibleSelected) {
      const set = new Set(visibleIds);
      const remaining = selectedCupIds.filter((id) => !set.has(id));
      selectAllCups(remaining);
    } else {
      const union = Array.from(new Set([...selectedCupIds, ...visibleIds]));
      selectAllCups(union);
    }
  }, [allVisibleSelected, selectAllCups, selectedCupIds, visibleIds]);

  const { handleRowCheckboxShiftMouseDown, onVisibleRowCheckboxChange } =
    useShiftRangeListSelection({
      orderedVisibleIds: visibleIds,
      mergeIntoSelection: mergeIntoCupSelection,
      toggleOne: toggleCupSelected,
    });

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
      <div className="space-y-4">
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
          <StatCard
            label="Total"
            value={stats.total}
            dotClassName="bg-blue-500"
            active={activeFilter === 'all'}
            onClick={() => setActiveFilter('all')}
          />
          <StatCard
            label="Visible"
            value={stats.visible}
            dotClassName="bg-emerald-500"
            active={activeFilter === 'visible'}
            onClick={() => setActiveFilter('visible')}
          />
          <StatCard
            label="Featured"
            value={stats.featured}
            dotClassName="bg-amber-500"
            active={activeFilter === 'featured'}
            onClick={() => setActiveFilter('featured')}
          />
          <StatCard
            label="Upcoming"
            value={stats.upcoming}
            dotClassName="bg-violet-500"
            active={activeFilter === 'upcoming'}
            onClick={() => setActiveFilter('upcoming')}
          />
          {stats.removed > 0 && (
            <StatCard
              label="Removed"
              value={stats.removed}
              dotClassName="bg-red-400"
              active={activeFilter === 'removed'}
              onClick={() => setActiveFilter('removed')}
            />
          )}
        </div>

        {selectedCount > 0 && (
          <BulkActionBar
            selectedCount={selectedCount}
            onClearSelection={clearCupSelection}
            actions={[
              {
                label: t('slots.properties'),
                icon: SlidersHorizontal,
                onClick: () => setShowBulkPropertiesDialog(true),
              },
              {
                label: t('common.delete'),
                icon: Trash2,
                variant: 'destructive',
                onClick: () => setShowBulkDeleteModal(true),
              },
            ]}
          />
        )}

        <BulkDeleteModal
          isOpen={showBulkDeleteModal}
          onClose={() => setShowBulkDeleteModal(false)}
          onConfirm={async () => {
            await deleteCups(selectedCupIds);
            setShowBulkDeleteModal(false);
          }}
          itemCount={selectedCount}
          itemLabel={selectedCount === 1 ? 'cup' : 'cups'}
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

        <Card
          className={cn(
            'rounded-xl border-0',
            viewMode === 'grid'
              ? 'overflow-visible bg-transparent shadow-none'
              : 'overflow-hidden bg-white shadow-sm dark:bg-slate-950',
          )}
        >
          <div
            className={cn(
              'flex flex-shrink-0 items-center justify-between gap-3 px-4 py-3',
              viewMode === 'grid' && 'mx-1 mt-1 rounded-xl bg-white dark:bg-slate-950',
            )}
          >
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
              <div className="inline-flex items-center rounded-md border border-border/30 bg-muted/40 p-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Grid3x3}
                  className={cn(
                    'h-7 rounded-[6px] px-2 text-xs',
                    viewMode === 'grid'
                      ? 'bg-background text-foreground shadow-sm hover:bg-background'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => setViewMode('grid')}
                >
                  {t('slots.grid')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={List}
                  className={cn(
                    'h-7 rounded-[6px] px-2 text-xs',
                    viewMode === 'list'
                      ? 'bg-background text-foreground shadow-sm hover:bg-background'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => setViewMode('list')}
                >
                  {t('slots.list')}
                </Button>
              </div>
            </div>
          </div>

          {filteredAndSorted.length === 0 ? (
            <Card className="shadow-none">
              <div className="p-6 text-center text-sm text-muted-foreground">
                {search.trim() ? t('cups.noMatch') : t('cups.noYet')}
              </div>
            </Card>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 gap-4 px-1 pb-1 pt-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredAndSorted.map((cup, index) => (
                <CupCard
                  key={cup.id}
                  cup={cup}
                  selected={isSelected(cup.id)}
                  ingestTitle={ingestTitleForCup(cup.ingest_source_id) || null}
                  onClick={() => attemptNavigation(() => openCupForView(cup))}
                  checkbox={
                    <input
                      type="checkbox"
                      checked={isSelected(cup.id)}
                      onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                      onChange={() => onVisibleRowCheckboxChange(cup.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 cursor-pointer"
                    />
                  }
                />
              ))}
            </div>
          ) : (
            <Card className="shadow-none">
              <Table rowBorders={false}>
                <TableHeader className="bg-slate-50/90 dark:bg-slate-900/50">
                  <TableRow className="h-8">
                    <TableHead className="w-10 py-1.5 text-xs">
                      <input
                        ref={headerCheckboxRef}
                        type="checkbox"
                        className="h-3.5 w-3.5 cursor-pointer"
                        checked={allVisibleSelected}
                        onChange={onToggleAllVisible}
                      />
                    </TableHead>
                    <SortableHead
                      label={t('cups.columnName')}
                      field="name"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={(f) => {
                        if (sortField === f) {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortField(f);
                          setSortOrder('asc');
                        }
                      }}
                    />
                    <TableHead className="py-1.5 text-xs text-muted-foreground">Status</TableHead>
                    <SortableHead
                      label={t('cups.columnLocation')}
                      field="location"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={(f) => {
                        if (sortField === f) {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortField(f);
                          setSortOrder('asc');
                        }
                      }}
                    />
                    <SortableHead
                      label={t('cups.columnIngest')}
                      field="ingest"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      className="max-w-[12rem]"
                      onSort={(f) => {
                        if (sortField === f) {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortField(f);
                          setSortOrder('asc');
                        }
                      }}
                    />
                    <SortableHead
                      label={t('cups.columnStart')}
                      field="start_date"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={(f) => {
                        if (sortField === f) {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortField(f);
                          setSortOrder('asc');
                        }
                      }}
                    />
                    <SortableHead
                      label="Betyg"
                      field="ratings_count"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      className="w-20 text-right"
                      onSort={(f) => {
                        if (sortField === f) {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortField(f);
                          setSortOrder('desc');
                        }
                      }}
                    />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSorted.map((cup, index) => (
                    <TableRow
                      key={cup.id}
                      className={cn(
                        'h-9 cursor-pointer bg-white hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900/80',
                        isSelected(cup.id) && 'bg-plugin-subtle',
                        cup.deleted_at !== null && cup.deleted_at !== undefined && 'opacity-50',
                      )}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
                          return;
                        }
                        attemptNavigation(() => openCupForView(cup));
                      }}
                      role="button"
                    >
                      <TableCell
                        className="w-10 py-1.5 text-xs"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected(cup.id)}
                          onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                          onChange={() => onVisibleRowCheckboxChange(cup.id)}
                          className="h-3.5 w-3.5 cursor-pointer"
                        />
                      </TableCell>
                      <TableCell className="py-1.5">
                        <div className="flex flex-col gap-0">
                          <span className="text-sm font-medium leading-tight">
                            {cup.name || '—'}
                          </span>
                          {cup.organizer && (
                            <span className="text-[11px] leading-tight text-muted-foreground">
                              {cup.organizer}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-1.5">
                        <div className="flex items-center gap-1">
                          {cup.visible ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                              Vis
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                              Dold
                            </span>
                          )}
                          {cup.featured && (
                            <span className="inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                              Top
                            </span>
                          )}
                          {cup.deleted_at !== null && cup.deleted_at !== undefined && (
                            <span className="inline-flex items-center rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-600 dark:bg-red-950/40 dark:text-red-400">
                              Borttagen
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-1.5 text-xs text-muted-foreground">
                        {cup.location || '—'}
                      </TableCell>
                      <TableCell
                        className="max-w-[12rem] truncate py-1.5 text-xs text-muted-foreground"
                        title={ingestTitleForCup(cup.ingest_source_id) || undefined}
                      >
                        {ingestTitleForCup(cup.ingest_source_id) || '—'}
                      </TableCell>
                      <TableCell className="py-1.5 text-xs text-muted-foreground">
                        {cup.start_date
                          ? new Date(cup.start_date).toLocaleDateString('sv-SE')
                          : '—'}
                      </TableCell>
                      <TableCell className="w-20 py-1.5 text-right text-xs tabular-nums text-muted-foreground">
                        {cup.ratings_count > 0 ? (
                          <span className="font-medium text-foreground">{cup.ratings_count}</span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
          <div
            className={cn(
              'px-4 py-2 text-xs text-muted-foreground',
              viewMode === 'grid'
                ? 'mx-1 mb-1 mt-3 rounded-xl bg-white dark:bg-slate-950'
                : 'border-t border-border/60',
            )}
          >
            Showing {filteredAndSorted.length} of{' '}
            {activeFilter === 'removed' ? stats.removed : stats.total} Cups
          </div>
        </Card>
      </div>
    </div>
  );
}

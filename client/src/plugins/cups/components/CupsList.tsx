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
import {
  CupIngestImportResultDialog,
  type CupIngestImportResultVariant,
} from './CupIngestImportResultDialog';
import { CupIngestPickSourceDialog } from './CupIngestPickSourceDialog';
import { CupsSettingsView, type CupsSettingsCategory } from './CupsSettingsView';

type SortField = 'name' | 'start_date' | 'location' | 'updated_at' | 'ingest' | 'featured';
type SortOrder = 'asc' | 'desc';
type CupsViewMode = 'grid' | 'list';

const CUPS_VIEW_MODE_STORAGE_KEY = 'cups:viewMode';

function StatCard({
  label,
  value,
  dotClassName,
}: {
  label: string;
  value: number;
  dotClassName: string;
}) {
  return (
    <Card className="rounded-xl border-0 bg-card p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">
        <span className={cn('h-1.5 w-1.5 rounded-full', dotClassName)} aria-hidden />
        <span>{label}</span>
      </div>
      <div className="text-2xl font-semibold tracking-tight text-foreground">{value}</div>
    </Card>
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
    const q = search.trim().toLowerCase();
    if (!q) {
      return cups;
    }
    return cups.filter((c) => {
      const ingestTitle = ingestTitleForCup(c.ingest_source_id);
      return [c.name, c.organizer, c.location, c.categories, ingestTitle]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [cups, search, ingestTitleForCup]);

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
  const stats = useMemo(
    () => ({
      total: cups.length,
      visible: cups.filter((c) => Boolean(c.visible)).length,
      featured: cups.filter((c) => Boolean(c.featured)).length,
      withIngest: cups.filter((c) => Boolean(c.ingest_source_id)).length,
    }),
    [cups],
  );

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

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Total" value={stats.total} dotClassName="bg-blue-500" />
          <StatCard label="Visible" value={stats.visible} dotClassName="bg-emerald-500" />
          <StatCard label="Featured" value={stats.featured} dotClassName="bg-amber-500" />
          <StatCard label="Ingest Linked" value={stats.withIngest} dotClassName="bg-violet-500" />
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
            errors={importResult.errors}
          />
        )}

        <Card className="overflow-hidden rounded-xl border-0 bg-white shadow-sm dark:bg-slate-950">
          <div className="flex flex-shrink-0 items-center justify-between gap-3 px-4 py-3">
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
              <Button
                variant="ghost"
                size="sm"
                icon={Settings}
                className="h-8 px-2.5 text-xs"
                onClick={openCupSettings}
              >
                {t('common.settings')}
              </Button>
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
            <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredAndSorted.map((cup, index) => (
                <Card
                  key={cup.id}
                  className={cn(
                    'relative flex h-full min-h-[140px] cursor-pointer flex-col gap-3 rounded-xl border-0 bg-card p-5 shadow-sm transition-all',
                    isSelected(cup.id)
                      ? 'plugin-cups bg-plugin-subtle ring-1 border-plugin-subtle'
                      : 'hover:border-plugin-subtle hover:plugin-cups hover:shadow-md',
                  )}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
                      return;
                    }
                    attemptNavigation(() => openCupForView(cup));
                  }}
                  role="button"
                >
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="checkbox"
                      checked={isSelected(cup.id)}
                      onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                      onChange={() => onVisibleRowCheckboxChange(cup.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 cursor-pointer"
                    />
                  </div>
                  <h3 className="text-sm font-semibold leading-snug">{cup.name || '—'}</h3>
                  <div className="flex min-h-0 flex-1 flex-col gap-2 text-xs text-muted-foreground">
                    <div>
                      {cup.location || '—'}
                      {' · '}
                      {cup.start_date ? new Date(cup.start_date).toLocaleDateString('sv-SE') : '—'}
                      {' · '}
                      {cup.visible ? t('common.visible') : t('common.hidden')}
                      {' · '}
                      {cup.featured ? t('cups.featured') : t('cups.notFeatured')}
                    </div>
                    {ingestTitleForCup(cup.ingest_source_id) ? (
                      <div>
                        {t('cups.ingestLine', { title: ingestTitleForCup(cup.ingest_source_id) })}
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-auto text-[10px] leading-snug text-muted-foreground">
                    {t('common.updated')}: {new Date(cup.updated_at).toLocaleDateString('sv-SE')}
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="shadow-none">
              <Table rowBorders={false}>
                <TableHeader className="bg-slate-50/90 dark:bg-slate-900/50">
                  <TableRow>
                    <TableHead className="w-12 text-xs">
                      <input
                        ref={headerCheckboxRef}
                        type="checkbox"
                        className="h-4 w-4 cursor-pointer"
                        checked={allVisibleSelected}
                        onChange={onToggleAllVisible}
                      />
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none text-xs hover:bg-muted/50"
                      onClick={() => {
                        if (sortField === 'name') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortField('name');
                          setSortOrder('asc');
                        }
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span>{t('cups.columnName')}</span>
                        {sortField === 'name' &&
                          (sortOrder === 'asc' ? (
                            <ArrowUp className="inline h-3 w-3" />
                          ) : (
                            <ArrowDown className="inline h-3 w-3" />
                          ))}
                      </div>
                    </TableHead>
                    <TableHead className="text-xs">Organizer</TableHead>
                    <TableHead className="text-xs">Visible</TableHead>
                    <TableHead
                      className="cursor-pointer select-none text-xs hover:bg-muted/50"
                      onClick={() => {
                        if (sortField === 'featured') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortField('featured');
                          setSortOrder('desc');
                        }
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span>{t('cups.columnFeatured')}</span>
                        {sortField === 'featured' &&
                          (sortOrder === 'asc' ? (
                            <ArrowUp className="inline h-3 w-3" />
                          ) : (
                            <ArrowDown className="inline h-3 w-3" />
                          ))}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none text-xs hover:bg-muted/50"
                      onClick={() => {
                        if (sortField === 'location') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortField('location');
                          setSortOrder('asc');
                        }
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span>{t('cups.columnLocation')}</span>
                        {sortField === 'location' &&
                          (sortOrder === 'asc' ? (
                            <ArrowUp className="inline h-3 w-3" />
                          ) : (
                            <ArrowDown className="inline h-3 w-3" />
                          ))}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none text-xs hover:bg-muted/50 max-w-[14rem]"
                      onClick={() => {
                        if (sortField === 'ingest') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortField('ingest');
                          setSortOrder('asc');
                        }
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span>{t('cups.columnIngest')}</span>
                        {sortField === 'ingest' &&
                          (sortOrder === 'asc' ? (
                            <ArrowUp className="inline h-3 w-3" />
                          ) : (
                            <ArrowDown className="inline h-3 w-3" />
                          ))}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none text-xs hover:bg-muted/50"
                      onClick={() => {
                        if (sortField === 'start_date') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortField('start_date');
                          setSortOrder('asc');
                        }
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span>{t('cups.columnStart')}</span>
                        {sortField === 'start_date' &&
                          (sortOrder === 'asc' ? (
                            <ArrowUp className="inline h-3 w-3" />
                          ) : (
                            <ArrowDown className="inline h-3 w-3" />
                          ))}
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSorted.map((cup, index) => (
                    <TableRow
                      key={cup.id}
                      className={cn(
                        'cursor-pointer bg-white hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900/80',
                        isSelected(cup.id) && 'bg-plugin-subtle',
                      )}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
                          return;
                        }
                        attemptNavigation(() => openCupForView(cup));
                      }}
                      role="button"
                    >
                      <TableCell className="w-12 text-xs" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected(cup.id)}
                          onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                          onChange={() => onVisibleRowCheckboxChange(cup.id)}
                          className="h-4 w-4 cursor-pointer"
                        />
                      </TableCell>
                      <TableCell className="font-medium">{cup.name || '—'}</TableCell>
                      <TableCell className="text-xs">{cup.organizer || '—'}</TableCell>
                      <TableCell className="text-xs">
                        {cup.visible ? t('common.yes') : t('common.no')}
                      </TableCell>
                      <TableCell className="text-xs">
                        {cup.featured ? t('common.yes') : t('common.no')}
                      </TableCell>
                      <TableCell className="text-xs">{cup.location || '—'}</TableCell>
                      <TableCell
                        className="max-w-[14rem] truncate text-xs"
                        title={ingestTitleForCup(cup.ingest_source_id) || undefined}
                      >
                        {ingestTitleForCup(cup.ingest_source_id) || '—'}
                      </TableCell>
                      <TableCell className="text-xs">
                        {cup.start_date
                          ? new Date(cup.start_date).toLocaleDateString('sv-SE')
                          : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </Card>
      </div>
    </div>
  );
}

import { ArrowDown, ArrowUp, Grid3x3, List, Plus, Search, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
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

import { useIngest } from '../hooks/useIngest';
import type { IngestSource } from '../types/ingest';

const INGEST_SETTINGS_KEY = 'ingest';
const INGEST_VIEW_MODE_STORAGE_KEY = 'ingest:viewMode';

type ViewMode = 'grid' | 'list';
type SortField = 'name' | 'sourceType' | 'lastFetchedAt' | 'updatedAt' | 'lastFetchStatus';
type SortOrder = 'asc' | 'desc';
type IngestFilter = 'all' | 'active' | 'success' | 'failed';

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

function getInitialViewMode(): ViewMode {
  if (typeof window === 'undefined') {
    return 'list';
  }
  return window.sessionStorage.getItem(INGEST_VIEW_MODE_STORAGE_KEY) === 'grid' ? 'grid' : 'list';
}

function statusBadgeClass(status: string) {
  if (status === 'success') {
    return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
  }
  if (status === 'failed') {
    return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
  }
  if (status === 'running') {
    return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300';
  }
  return 'bg-muted text-muted-foreground';
}

function formatDateTimeShort(iso: string | null) {
  if (!iso) {
    return '—';
  }
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

export const IngestSourceList: React.FC = () => {
  const { t } = useTranslation();
  const { getSettings, updateSettings, settingsVersion } = useApp();
  const { attemptNavigation } = useGlobalNavigationGuard();
  const {
    ingest,
    openIngestPanel,
    openIngestForView,
    validationErrors,
    selectedIngestIds,
    toggleIngestSelected,
    mergeIntoIngestSelection,
    selectAllIngest,
    clearIngestSelection,
    selectedCount,
    isSelected,
    deleteIngestSources,
  } = useIngest();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [viewMode, setViewModeState] = useState<ViewMode>(getInitialViewMode);
  const [activeFilter, setActiveFilter] = useState<IngestFilter>('all');
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    getSettings(INGEST_SETTINGS_KEY)
      .then((settings: { viewMode?: ViewMode }) => {
        if (!cancelled) {
          const nextMode: ViewMode = settings?.viewMode === 'grid' ? 'grid' : 'list';
          setViewModeState(nextMode);
          if (typeof window !== 'undefined') {
            window.sessionStorage.setItem(INGEST_VIEW_MODE_STORAGE_KEY, nextMode);
          }
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  const setViewMode = useCallback(
    (mode: ViewMode) => {
      setViewModeState(mode);
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(INGEST_VIEW_MODE_STORAGE_KEY, mode);
      }
      updateSettings(INGEST_SETTINGS_KEY, { viewMode: mode }).catch(() => {});
    },
    [updateSettings],
  );

  const filteredAndSorted = useMemo(() => {
    const byFilter = ingest.filter((s) => {
      if (activeFilter === 'active') {
        return Boolean(s.isActive);
      }
      if (activeFilter === 'success') {
        return s.lastFetchStatus === 'success';
      }
      if (activeFilter === 'failed') {
        return s.lastFetchStatus === 'failed';
      }
      return true;
    });

    const needle = searchTerm.trim().toLowerCase();
    const filtered = byFilter.filter((s) => {
      if (!needle) {
        return true;
      }
      return (
        s.name.toLowerCase().includes(needle) ||
        s.sourceUrl.toLowerCase().includes(needle) ||
        s.sourceType.toLowerCase().includes(needle) ||
        s.lastFetchStatus.toLowerCase().includes(needle)
      );
    });

    return [...filtered].sort((a, b) => {
      const flip = sortOrder === 'asc' ? 1 : -1;
      if (sortField === 'lastFetchedAt') {
        const ta = a.lastFetchedAt ? new Date(a.lastFetchedAt).getTime() : 0;
        const tb = b.lastFetchedAt ? new Date(b.lastFetchedAt).getTime() : 0;
        return flip * (ta - tb);
      }
      if (sortField === 'updatedAt') {
        const ta = new Date(a.updatedAt).getTime();
        const tb = new Date(b.updatedAt).getTime();
        return flip * (ta - tb);
      }
      if (sortField === 'name') {
        const cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        return flip * cmp;
      }
      if (sortField === 'sourceType') {
        const cmp = a.sourceType.localeCompare(b.sourceType, undefined, { sensitivity: 'base' });
        return flip * cmp;
      }
      const cmp = a.lastFetchStatus.localeCompare(b.lastFetchStatus, undefined, {
        sensitivity: 'base',
      });
      return flip * cmp;
    });
  }, [ingest, searchTerm, sortField, sortOrder, activeFilter]);
  const stats = useMemo(
    () => ({
      total: ingest.length,
      active: ingest.filter((s) => Boolean(s.isActive)).length,
      success: ingest.filter((s) => s.lastFetchStatus === 'success').length,
      failed: ingest.filter((s) => s.lastFetchStatus === 'failed').length,
    }),
    [ingest],
  );

  const visibleSourceIds = useMemo(
    () => filteredAndSorted.map((s) => String(s.id)),
    [filteredAndSorted],
  );

  const { handleRowCheckboxShiftMouseDown, onVisibleRowCheckboxChange } =
    useShiftRangeListSelection({
      orderedVisibleIds: visibleSourceIds,
      mergeIntoSelection: mergeIntoIngestSelection,
      toggleOne: (id) => toggleIngestSelected(String(id)),
    });

  const allVisibleSelected = useMemo(
    () => visibleSourceIds.length > 0 && visibleSourceIds.every((id) => isSelected(id)),
    [visibleSourceIds, isSelected],
  );

  const someVisibleSelected = useMemo(
    () => visibleSourceIds.some((id) => isSelected(id)),
    [visibleSourceIds, isSelected],
  );

  useEffect(() => {
    if (!headerCheckboxRef.current) {
      return;
    }
    headerCheckboxRef.current.indeterminate = !allVisibleSelected && someVisibleSelected;
  }, [allVisibleSelected, someVisibleSelected]);

  const onToggleAllVisible = useCallback(() => {
    if (allVisibleSelected) {
      const set = new Set(visibleSourceIds);
      const remaining = selectedIngestIds.filter((id) => !set.has(String(id)));
      selectAllIngest(remaining);
    } else {
      const union = Array.from(new Set([...selectedIngestIds, ...visibleSourceIds]));
      selectAllIngest(union);
    }
  }, [allVisibleSelected, visibleSourceIds, selectedIngestIds, selectAllIngest]);

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        const defaultAsc =
          field === 'name' || field === 'sourceType' || field === 'lastFetchStatus';
        setSortOrder(defaultAsc ? 'asc' : 'desc');
      }
    },
    [sortField],
  );

  const handleOpenForView = (row: IngestSource) => attemptNavigation(() => openIngestForView(row));

  const handleBulkDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await deleteIngestSources(selectedIngestIds);
      setShowBulkDeleteModal(false);
    } finally {
      setDeleting(false);
    }
  }, [deleteIngestSources, selectedIngestIds]);

  const generalError = validationErrors.find((e) => e.field === 'general');

  const sortIcon = (field: SortField) =>
    sortField === field ? (
      sortOrder === 'asc' ? (
        <ArrowUp className="h-3 w-3 inline" />
      ) : (
        <ArrowDown className="h-3 w-3 inline" />
      )
    ) : null;

  return (
    <div className="plugin-ingest min-h-full bg-background px-6 py-4">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold tracking-tight">{t('nav.ingest')}</h2>
            <p className="text-sm text-muted-foreground">{t('ingest.listDescription')}</p>
          </div>
          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            className="h-9 px-3 text-xs"
            onClick={() => attemptNavigation(() => openIngestPanel(null))}
          >
            {t('ingest.addSource')}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            label="Total"
            value={stats.total}
            dotClassName="bg-blue-500"
            active={activeFilter === 'all'}
            onClick={() => setActiveFilter('all')}
          />
          <StatCard
            label="Active"
            value={stats.active}
            dotClassName="bg-emerald-500"
            active={activeFilter === 'active'}
            onClick={() => setActiveFilter('active')}
          />
          <StatCard
            label="Success"
            value={stats.success}
            dotClassName="bg-amber-500"
            active={activeFilter === 'success'}
            onClick={() => setActiveFilter('success')}
          />
          <StatCard
            label="Failed"
            value={stats.failed}
            dotClassName="bg-rose-500"
            active={activeFilter === 'failed'}
            onClick={() => setActiveFilter('failed')}
          />
        </div>

        {generalError && (
          <p className="text-sm text-destructive" role="alert">
            {generalError.message}
          </p>
        )}

        {selectedCount > 0 && (
          <BulkActionBar
            selectedCount={selectedCount}
            onClearSelection={clearIngestSelection}
            actions={[
              {
                label: t('common.delete'),
                icon: Trash2,
                onClick: () => setShowBulkDeleteModal(true),
                variant: 'destructive',
              },
            ]}
          />
        )}

        <BulkDeleteModal
          isOpen={showBulkDeleteModal}
          onClose={() => setShowBulkDeleteModal(false)}
          onConfirm={handleBulkDelete}
          itemCount={selectedCount}
          itemLabel="ingest"
          isLoading={deleting}
        />

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
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={t('ingest.searchPlaceholder', { count: ingest.length })}
                className="h-8 bg-background pl-9 text-xs"
              />
            </div>
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

          {filteredAndSorted.length === 0 ? (
            <Card className="shadow-none">
              <div className="p-6 text-center text-sm text-muted-foreground">
                {searchTerm.trim() ? t('ingest.noMatch') : t('ingest.noYet')}
              </div>
            </Card>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 gap-4 px-1 pb-1 pt-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredAndSorted.map((row, index) => {
                const selected = isSelected(row.id);
                return (
                  <Card
                    key={row.id}
                    className={cn(
                      'relative flex h-full min-h-[140px] cursor-pointer flex-col gap-3 rounded-xl border-0 bg-white p-5 shadow-sm transition-all dark:bg-slate-950',
                      selected
                        ? 'plugin-ingest bg-plugin-subtle ring-1 border-plugin-subtle'
                        : 'hover:border-plugin-subtle hover:plugin-ingest hover:shadow-md',
                    )}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
                        return;
                      }
                      handleOpenForView(row);
                    }}
                    data-list-item={JSON.stringify(row)}
                    data-plugin-name="ingest"
                    role="button"
                    aria-label={`Open ${row.name}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="checkbox"
                        checked={selected}
                        onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                        onChange={() => onVisibleRowCheckboxChange(String(row.id))}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 cursor-pointer"
                        aria-label={selected ? 'Deselect' : 'Select'}
                      />
                      <Badge
                        className={cn(
                          'border-0 rounded-md px-2 py-0.5 text-xs font-semibold',
                          statusBadgeClass(row.lastFetchStatus),
                        )}
                      >
                        {row.lastFetchStatus}
                      </Badge>
                    </div>
                    <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{row.name}</h3>
                    <div className="truncate text-xs text-muted-foreground">{row.sourceUrl}</div>
                    <div>
                      <Badge className="border-0 rounded-md px-2 py-0.5 text-xs font-semibold uppercase bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {row.sourceType}
                      </Badge>
                    </div>
                    <div className="flex min-h-0 flex-1 flex-col gap-1 text-xs text-muted-foreground">
                      <div>
                        {t('ingest.colLastFetched')}: {formatDateTimeShort(row.lastFetchedAt)}
                      </div>
                      <div>
                        {t('ingest.active')}: {row.isActive ? t('common.yes') : t('common.no')}
                      </div>
                    </div>
                    <div className="mt-auto flex flex-col gap-1 text-[10px] leading-snug text-muted-foreground">
                      <div>
                        {t('common.updated')}: {new Date(row.updatedAt).toLocaleDateString()}
                      </div>
                      <div>
                        {t('common.created')}: {new Date(row.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </Card>
                );
              })}
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
                        aria-label={allVisibleSelected ? 'Unselect all' : 'Select all'}
                        checked={allVisibleSelected}
                        onChange={onToggleAllVisible}
                      />
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none text-xs hover:bg-muted/50"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center gap-2">
                        <span>{t('ingest.colName')}</span>
                        {sortIcon('name')}
                      </div>
                    </TableHead>
                    <TableHead className="hidden text-xs md:table-cell">
                      {t('ingest.colUrl')}
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none text-xs hover:bg-muted/50"
                      onClick={() => handleSort('sourceType')}
                    >
                      <div className="flex items-center gap-2">
                        <span>{t('ingest.colType')}</span>
                        {sortIcon('sourceType')}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none text-xs hover:bg-muted/50"
                      onClick={() => handleSort('lastFetchStatus')}
                    >
                      <div className="flex items-center gap-2">
                        <span>{t('ingest.colStatus')}</span>
                        {sortIcon('lastFetchStatus')}
                      </div>
                    </TableHead>
                    <TableHead
                      className="hidden cursor-pointer select-none text-xs hover:bg-muted/50 lg:table-cell"
                      onClick={() => handleSort('lastFetchedAt')}
                    >
                      <div className="flex items-center gap-2">
                        <span>{t('ingest.colLastFetched')}</span>
                        {sortIcon('lastFetchedAt')}
                      </div>
                    </TableHead>
                    <TableHead className="hidden text-xs lg:table-cell">
                      {t('ingest.colActive')}
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none text-right text-xs hover:bg-muted/50"
                      onClick={() => handleSort('updatedAt')}
                    >
                      <div className="flex items-center justify-end gap-2">
                        <span>{t('common.updated')}</span>
                        {sortIcon('updatedAt')}
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSorted.map((row, index) => (
                    <TableRow
                      key={row.id}
                      className={cn(
                        'cursor-pointer hover:bg-muted/50',
                        isSelected(row.id) && 'bg-plugin-subtle',
                      )}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
                          return;
                        }
                        handleOpenForView(row);
                      }}
                      data-list-item={JSON.stringify(row)}
                      data-plugin-name="ingest"
                      role="button"
                      aria-label={`Open ${row.name}`}
                    >
                      <TableCell className="w-12 text-xs" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected(row.id)}
                          onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                          onChange={() => onVisibleRowCheckboxChange(String(row.id))}
                          className="h-4 w-4 cursor-pointer"
                          aria-label={isSelected(row.id) ? 'Deselect source' : 'Select source'}
                        />
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{row.name}</span>
                      </TableCell>
                      <TableCell className="hidden max-w-[240px] truncate text-xs text-muted-foreground md:table-cell">
                        {row.sourceUrl}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        <Badge className="border-0 rounded-md px-2 py-0.5 text-xs font-semibold uppercase bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {row.sourceType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            'border-0 rounded-md px-2 py-0.5 text-xs font-semibold',
                            statusBadgeClass(row.lastFetchStatus),
                          )}
                        >
                          {row.lastFetchStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap text-xs text-muted-foreground lg:table-cell">
                        {formatDateTimeShort(row.lastFetchedAt)}
                      </TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                        {row.isActive ? t('common.yes') : t('common.no')}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : '—'}
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
            Showing {filteredAndSorted.length} of {ingest.length} Sources
          </div>
        </Card>
      </div>
    </div>
  );
};

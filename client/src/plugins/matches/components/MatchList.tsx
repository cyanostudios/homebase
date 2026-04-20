import { ArrowDown, ArrowUp, Grid3x3, List, Plus, Search, Settings, Trash2, X } from 'lucide-react';
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

import { useMatches } from '../hooks/useMatches';
import type { Match } from '../types/match';

import { MatchSettingsView, type MatchSettingsCategory } from './MatchSettingsView';

const MATCHES_SETTINGS_KEY = 'matches';
type ViewMode = 'grid' | 'list';
type SortField = 'start_time' | 'home_team' | 'location' | 'updatedAt';
type SortOrder = 'asc' | 'desc';
const MATCHES_VIEW_MODE_STORAGE_KEY = 'matches:viewMode';

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

function getInitialViewMode(): ViewMode {
  if (typeof window === 'undefined') {
    return 'list';
  }
  return window.sessionStorage.getItem(MATCHES_VIEW_MODE_STORAGE_KEY) === 'grid' ? 'grid' : 'list';
}

export function MatchList() {
  const { t } = useTranslation();
  const {
    matches,
    matchesContentView,
    openMatchPanel,
    openMatchForView,
    openMatchSettings,
    closeMatchSettingsView,
    deleteMatch: _deleteMatch,
    deleteMatches,
    selectedMatchIds,
    toggleMatchSelected,
    mergeIntoMatchSelection,
    selectAllMatches,
    clearMatchSelection,
    selectedCount,
    isSelected,
    recentlyDuplicatedMatchId,
  } = useMatches();
  const { getSettings, updateSettings, settingsVersion } = useApp();
  const { attemptNavigation } = useGlobalNavigationGuard();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('start_time');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [viewMode, setViewModeState] = useState<ViewMode>(getInitialViewMode);
  const [settingsCategory, setSettingsCategory] = useState<MatchSettingsCategory>('view');
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    getSettings(MATCHES_SETTINGS_KEY)
      .then((settings: { viewMode?: ViewMode }) => {
        if (!cancelled) {
          const nextMode: ViewMode = settings?.viewMode === 'grid' ? 'grid' : 'list';
          setViewModeState(nextMode);
          if (typeof window !== 'undefined') {
            window.sessionStorage.setItem(MATCHES_VIEW_MODE_STORAGE_KEY, nextMode);
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
        window.sessionStorage.setItem(MATCHES_VIEW_MODE_STORAGE_KEY, mode);
      }
      updateSettings(MATCHES_SETTINGS_KEY, { viewMode: mode }).catch(() => {});
    },
    [updateSettings],
  );

  const formatDateTimeForFilter = useCallback(
    (s: string | null) =>
      s ? new Date(s).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' }) : '',
    [],
  );

  const filteredAndSorted = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    const filtered = matches.filter((m) => {
      if (!needle) {
        return true;
      }
      const timeStr = formatDateTimeForFilter(m.start_time ?? null).toLowerCase();
      return (
        (m.name ?? '').toLowerCase().includes(needle) ||
        (m.home_team ?? '').toLowerCase().includes(needle) ||
        (m.away_team ?? '').toLowerCase().includes(needle) ||
        (m.location ?? '').toLowerCase().includes(needle) ||
        (m.sport_type ?? '').toLowerCase().includes(needle) ||
        timeStr.includes(needle)
      );
    });
    return [...filtered].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;
      switch (sortField) {
        case 'start_time':
          aVal = a.start_time ? new Date(a.start_time).getTime() : 0;
          bVal = b.start_time ? new Date(b.start_time).getTime() : 0;
          return sortOrder === 'asc'
            ? (aVal as number) - (bVal as number)
            : (bVal as number) - (aVal as number);
        case 'home_team':
          aVal = (a.home_team ?? '').toLowerCase();
          bVal = (b.home_team ?? '').toLowerCase();
          break;
        case 'location':
          aVal = (a.location ?? '').toLowerCase();
          bVal = (b.location ?? '').toLowerCase();
          break;
        case 'updatedAt':
          aVal = a.updated_at ? new Date(a.updated_at).getTime() : 0;
          bVal = b.updated_at ? new Date(b.updated_at).getTime() : 0;
          return sortOrder === 'asc'
            ? (aVal as number) - (bVal as number)
            : (bVal as number) - (aVal as number);
        default:
          aVal = '';
          bVal = '';
      }
      const cmp = String(aVal).localeCompare(String(bVal), undefined, { sensitivity: 'base' });
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [matches, searchTerm, sortField, sortOrder, formatDateTimeForFilter]);

  const visibleMatchIds = useMemo(
    () => filteredAndSorted.map((m) => String(m.id)),
    [filteredAndSorted],
  );
  const stats = useMemo(
    () => ({
      total: matches.length,
      upcoming: matches.filter((m) => new Date(m.start_time).getTime() > Date.now()).length,
      futsal: matches.filter((m) => (m.format || '').toLowerCase() === 'futsal').length,
      withLocation: matches.filter((m) => Boolean(m.location?.trim())).length,
    }),
    [matches],
  );

  const { handleRowCheckboxShiftMouseDown, onVisibleRowCheckboxChange } =
    useShiftRangeListSelection({
      orderedVisibleIds: visibleMatchIds,
      mergeIntoSelection: mergeIntoMatchSelection,
      toggleOne: toggleMatchSelected,
    });

  const allVisibleSelected = useMemo(
    () => visibleMatchIds.length > 0 && visibleMatchIds.every((id) => isSelected(id)),
    [visibleMatchIds, isSelected],
  );
  const someVisibleSelected = useMemo(
    () => visibleMatchIds.some((id) => isSelected(id)),
    [visibleMatchIds, isSelected],
  );
  useEffect(() => {
    if (!headerCheckboxRef.current) {
      return;
    }
    headerCheckboxRef.current.indeterminate = !allVisibleSelected && someVisibleSelected;
  }, [allVisibleSelected, someVisibleSelected]);
  const onToggleAllVisible = useCallback(() => {
    if (allVisibleSelected) {
      const set = new Set(visibleMatchIds);
      const remaining = selectedMatchIds.filter((id) => !set.has(id));
      selectAllMatches(remaining);
    } else {
      const union = Array.from(new Set([...selectedMatchIds, ...visibleMatchIds]));
      selectAllMatches(union);
    }
  }, [allVisibleSelected, visibleMatchIds, selectedMatchIds, selectAllMatches]);

  const handleOpenForView = (match: Match) => attemptNavigation(() => openMatchForView(match));

  const handleBulkDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await deleteMatches(selectedMatchIds);
      setShowBulkDeleteModal(false);
    } finally {
      setDeleting(false);
    }
  }, [deleteMatches, selectedMatchIds]);

  const formatDateTime = (s: string | null) =>
    s ? new Date(s).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' }) : '—';

  if (matchesContentView === 'settings') {
    return (
      <div className="plugin-matches min-h-full bg-background">
        <div className="px-6 py-4">
          <MatchSettingsView
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
                onClick={closeMatchSettingsView}
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
    <div className="plugin-matches min-h-full bg-background px-6 py-4">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold tracking-tight">{t('nav.matches')}</h2>
            <p className="text-sm text-muted-foreground">{t('matches.listDescription')}</p>
          </div>
          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            className="h-9 px-3 text-xs"
            onClick={() => attemptNavigation(() => openMatchPanel(null))}
          >
            {t('matches.addMatch')}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Total" value={stats.total} dotClassName="bg-blue-500" />
          <StatCard label="Upcoming" value={stats.upcoming} dotClassName="bg-emerald-500" />
          <StatCard label="Futsal" value={stats.futsal} dotClassName="bg-indigo-500" />
          <StatCard label="With Location" value={stats.withLocation} dotClassName="bg-amber-500" />
        </div>

        {selectedCount > 0 && (
          <BulkActionBar
            selectedCount={selectedCount}
            onClearSelection={clearMatchSelection}
            actions={[
              {
                label: 'Delete',
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
          itemLabel="matches"
          isLoading={deleting}
        />

        <Card className="overflow-hidden rounded-xl border-0 bg-white shadow-sm dark:bg-slate-950">
          <div className="flex flex-shrink-0 items-center justify-between gap-3 px-4 py-3">
            <div className="relative w-full max-w-sm md:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={t('matches.searchPlaceholder', { count: matches.length })}
                className="h-8 bg-background pl-9 text-xs"
              />
            </div>
            <div className="flex flex-shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                icon={Settings}
                className="h-8 px-2.5 text-xs"
                onClick={() => openMatchSettings()}
                title={t('matches.settings')}
              >
                {t('matches.settings')}
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
              <div className="p-6 text-center text-muted-foreground">
                {searchTerm
                  ? 'No matches match your search.'
                  : 'No matches yet. Click "Add match" to add one.'}
              </div>
            </Card>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredAndSorted.map((match, index) => {
                const selected = isSelected(match.id);
                return (
                  <Card
                    key={match.id}
                    className={cn(
                      'relative flex h-full min-h-[140px] cursor-pointer flex-col gap-3 rounded-xl border-0 bg-card p-5 shadow-sm transition-all',
                      selected
                        ? 'plugin-matches bg-plugin-subtle ring-1 border-plugin-subtle'
                        : 'hover:border-plugin-subtle hover:plugin-matches hover:shadow-md',
                      recentlyDuplicatedMatchId === String(match.id) &&
                        'bg-green-50 dark:bg-green-950/30',
                    )}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
                        return;
                      }
                      handleOpenForView(match);
                    }}
                    data-list-item={JSON.stringify(match)}
                    data-plugin-name="matches"
                    role="button"
                    aria-label={`Open ${match.home_team} – ${match.away_team}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="checkbox"
                        checked={selected}
                        onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                        onChange={() => onVisibleRowCheckboxChange(match.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="cursor-pointer h-4 w-4"
                        aria-label={selected ? 'Deselect' : 'Select'}
                      />
                      <span className="text-[10px] text-muted-foreground">
                        {match.sport_type}
                        {match.format ? ` · ${match.format}` : ''}
                      </span>
                    </div>
                    <h3 className="line-clamp-1 text-base font-semibold leading-snug">
                      {match.name?.trim() || `${match.home_team} – ${match.away_team}`}
                    </h3>
                    <div className="text-xs leading-snug text-muted-foreground">
                      {match.home_team} – {match.away_team}
                    </div>
                    {match.location && (
                      <div className="truncate text-xs text-muted-foreground">{match.location}</div>
                    )}
                    <div className="flex min-h-0 flex-1 flex-col gap-1 text-xs text-muted-foreground">
                      <div>{formatDateTime(match.start_time)}</div>
                      {match.total_minutes !== null && match.total_minutes !== undefined && (
                        <div>{match.total_minutes} min</div>
                      )}
                    </div>
                    <div className="mt-auto flex flex-col gap-1 text-[10px] leading-snug text-muted-foreground">
                      <div>Updated: {new Date(match.updated_at).toLocaleDateString('sv-SE')}</div>
                      <div>Created: {new Date(match.created_at).toLocaleDateString('sv-SE')}</div>
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
                      className="cursor-pointer hover:bg-muted/50 select-none text-xs"
                      onClick={() => {
                        if (sortField === 'home_team') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortField('home_team');
                          setSortOrder('asc');
                        }
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span>Match</span>
                        {sortField === 'home_team' &&
                          (sortOrder === 'asc' ? (
                            <ArrowUp className="h-3 w-3 inline" />
                          ) : (
                            <ArrowDown className="h-3 w-3 inline" />
                          ))}
                      </div>
                    </TableHead>
                    <TableHead className="text-xs">Sport · Format</TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 select-none text-xs"
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
                        <span>Location</span>
                        {sortField === 'location' &&
                          (sortOrder === 'asc' ? (
                            <ArrowUp className="h-3 w-3 inline" />
                          ) : (
                            <ArrowDown className="h-3 w-3 inline" />
                          ))}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 select-none text-xs"
                      onClick={() => {
                        if (sortField === 'start_time') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortField('start_time');
                          setSortOrder('asc');
                        }
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span>Time</span>
                        {sortField === 'start_time' &&
                          (sortOrder === 'asc' ? (
                            <ArrowUp className="h-3 w-3 inline" />
                          ) : (
                            <ArrowDown className="h-3 w-3 inline" />
                          ))}
                      </div>
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer hover:bg-muted/50 select-none text-xs"
                      onClick={() => {
                        if (sortField === 'updatedAt') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortField('updatedAt');
                          setSortOrder('asc');
                        }
                      }}
                    >
                      <div className="flex items-center justify-end gap-2">
                        <span>Updated</span>
                        {sortField === 'updatedAt' &&
                          (sortOrder === 'asc' ? (
                            <ArrowUp className="h-3 w-3 inline" />
                          ) : (
                            <ArrowDown className="h-3 w-3 inline" />
                          ))}
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSorted.map((match, index) => (
                    <TableRow
                      key={match.id}
                      className={cn(
                        'cursor-pointer bg-white hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900/80',
                        isSelected(match.id) && 'bg-plugin-subtle',
                        recentlyDuplicatedMatchId === String(match.id) &&
                          'bg-green-50 dark:bg-green-950/30',
                      )}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
                          return;
                        }
                        handleOpenForView(match);
                      }}
                      data-list-item={JSON.stringify(match)}
                      data-plugin-name="matches"
                      role="button"
                      aria-label={`Open ${match.home_team} – ${match.away_team}`}
                    >
                      <TableCell className="w-12 text-xs" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected(match.id)}
                          onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                          onChange={() => onVisibleRowCheckboxChange(match.id)}
                          className="cursor-pointer h-4 w-4"
                          aria-label={isSelected(match.id) ? 'Unselect match' : 'Select match'}
                        />
                      </TableCell>
                      <TableCell className="font-semibold">
                        {match.name?.trim() || `${match.home_team} – ${match.away_team}`}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {match.sport_type}
                        {match.format ? ` · ${match.format}` : ''}
                        {match.total_minutes !== null && match.total_minutes !== undefined
                          ? ` · ${match.total_minutes} min`
                          : ''}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {match.location || '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {formatDateTime(match.start_time)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground text-xs">
                        {match.updated_at
                          ? new Date(match.updated_at).toLocaleDateString('sv-SE')
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

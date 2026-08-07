import {
  CheckSquare,
  ArrowDown,
  ArrowUp,
  Plus,
  Search,
  Settings,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
import { ListEmptyState } from '@/core/ui/ListEmptyState';
import { ListFooterBar } from '@/core/ui/ListFooterBar';
import { ListToolbar } from '@/core/ui/ListToolbar';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';

import { useMatches } from '../hooks/useMatches';
import { type Match } from '../types/match';
import {
  getInitialMatchColumnCount,
  resolveMatchColumnCount,
  MATCHES_COLUMN_COUNT_STORAGE_KEY,
  MATCHES_SETTINGS_KEY,
  type MatchColumnCount,
} from '../utils/matchColumnCount';
import {
  compareMatchesByField,
  isMatchStringSortField,
  type MatchSortField,
  type MatchSortOrder,
} from '../utils/matchListSort';

import { MatchListItem } from './MatchListItem';
import { MatchSettingsView, type MatchSettingsCategory } from './MatchSettingsView';

type SortField = MatchSortField;
type SortOrder = MatchSortOrder;
type MatchFilter = 'all' | 'upcoming' | 'futsal' | 'withLocation';

const SORT_FIELD_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'start_time', label: 'Time' },
  { value: 'home_team', label: 'Home team' },
  { value: 'away_team', label: 'Away team' },
  { value: 'location', label: 'Location' },
  { value: 'competition_name', label: 'Competition' },
  { value: 'updated_at', label: 'Updated' },
  { value: 'created_at', label: 'Created' },
];

const COLUMN_OPTIONS: MatchColumnCount[] = [1, 2, 3];

export function MatchList() {
  const { t } = useTranslation();
  const {
    matches,
    matchesContentView,
    openMatchPanel,
    openMatchForView,
    openMatchSettings,
    closeMatchSettingsView,
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
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [primarySort, setPrimarySort] = useState<SortField>('start_time');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [columnCount, setColumnCountState] = useState<MatchColumnCount>(getInitialMatchColumnCount);
  const [activeFilter, setActiveFilter] = useState<MatchFilter>('all');
  const [settingsCategory, setSettingsCategory] = useState<MatchSettingsCategory>('view');

  useEffect(() => {
    let cancelled = false;
    getSettings(MATCHES_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        const next = resolveMatchColumnCount(settings);
        setColumnCountState(next);
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(MATCHES_COLUMN_COUNT_STORAGE_KEY, String(next));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  const setColumnCount = useCallback(
    (count: MatchColumnCount) => {
      setColumnCountState(count);
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(MATCHES_COLUMN_COUNT_STORAGE_KEY, String(count));
      }
      updateSettings(MATCHES_SETTINGS_KEY, { columnCount: count }).catch(() => {});
    },
    [updateSettings],
  );

  const handlePrimarySortChange = (field: SortField) => {
    setPrimarySort(field);
    setSortOrder(isMatchStringSortField(field) ? 'asc' : 'desc');
  };

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const filteredAndSorted = useMemo(() => {
    const byFilter = matches.filter((m) => {
      if (activeFilter === 'upcoming') {
        return new Date(m.start_time).getTime() > Date.now();
      }
      if (activeFilter === 'futsal') {
        return (m.format || '').toLowerCase() === 'futsal';
      }
      if (activeFilter === 'withLocation') {
        return Boolean(m.location?.trim());
      }
      return true;
    });

    const needle = searchTerm.trim().toLowerCase();
    const filtered = byFilter.filter((m) => {
      if (!needle) {
        return true;
      }
      const timeStr = m.start_time
        ? new Date(m.start_time)
            .toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })
            .toLowerCase()
        : '';
      return (
        (m.name ?? '').toLowerCase().includes(needle) ||
        (m.home_team ?? '').toLowerCase().includes(needle) ||
        (m.away_team ?? '').toLowerCase().includes(needle) ||
        (m.location ?? '').toLowerCase().includes(needle) ||
        (m.sport_type ?? '').toLowerCase().includes(needle) ||
        (m.competition_name ?? '').toLowerCase().includes(needle) ||
        timeStr.includes(needle)
      );
    });

    return [...filtered].sort((a, b) => compareMatchesByField(a, b, primarySort, sortOrder));
  }, [matches, searchTerm, primarySort, sortOrder, activeFilter]);

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

  const handleHeaderCheckboxChange = () => {
    if (allVisibleSelected) {
      clearMatchSelection();
    } else {
      const union = Array.from(new Set([...selectedMatchIds, ...visibleMatchIds]));
      selectAllMatches(union);
    }
  };

  const handleOpenForView = (match: Match) => attemptNavigation(() => openMatchForView(match));

  const handleBulkDelete = async () => {
    if (selectedMatchIds.length === 0) {
      return;
    }
    setDeleting(true);
    try {
      await deleteMatches(selectedMatchIds);
      setShowBulkDeleteModal(false);
    } catch (err: any) {
      console.error('Bulk delete failed:', err);
    } finally {
      setDeleting(false);
    }
  };

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
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold tracking-tight">{t('nav.matches')}</h2>
            <p className="text-sm text-muted-foreground">{t('matches.listDescription')}</p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              icon={Settings}
              className="h-9 px-2.5 text-xs"
              onClick={() => openMatchSettings()}
              title={t('matches.settings')}
            >
              {t('matches.settings')}
            </Button>
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
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <ListFilterStatCard
            label="Total"
            value={stats.total}
            dotClassName="bg-blue-500"
            active={activeFilter === 'all'}
            onClick={() => setActiveFilter('all')}
          />
          <ListFilterStatCard
            label="Upcoming"
            value={stats.upcoming}
            dotClassName="bg-emerald-500"
            active={activeFilter === 'upcoming'}
            onClick={() => setActiveFilter('upcoming')}
          />
          <ListFilterStatCard
            label="Futsal"
            value={stats.futsal}
            dotClassName="bg-indigo-500"
            active={activeFilter === 'futsal'}
            onClick={() => setActiveFilter('futsal')}
          />
          <ListFilterStatCard
            label="With Location"
            value={stats.withLocation}
            dotClassName="bg-amber-500"
            active={activeFilter === 'withLocation'}
            onClick={() => setActiveFilter('withLocation')}
          />
        </div>

        <BulkDeleteModal
          isOpen={showBulkDeleteModal}
          onClose={() => setShowBulkDeleteModal(false)}
          onConfirm={handleBulkDelete}
          itemCount={selectedCount}
          itemLabel="matches"
          isLoading={deleting}
        />

        <div className="flex flex-col gap-3">
          <ListToolbar
            selectedCount={selectedCount}
            showSelectAll={filteredAndSorted.length > 0}
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
              <div className="relative w-full max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder={t('matches.searchPlaceholder', { count: matches.length })}
                  className="h-8 bg-background pl-9 text-xs"
                />
              </div>
            }
            trailing={
              <>
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
                      aria-label={t(`matches.columns${count}`)}
                      aria-pressed={columnCount === count}
                    >
                      {count}
                    </Button>
                  ))}
                </div>
              </>
            }
            bulkActions={
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={XCircle}
                  className="h-9 px-3 text-xs text-red-600 underline decoration-red-600/50 hover:bg-red-50 hover:text-red-700 hover:decoration-red-700 dark:text-red-400 dark:decoration-red-400/50 dark:hover:bg-red-950/30 dark:hover:text-red-300"
                  onClick={clearMatchSelection}
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
                  icon={Trash2}
                  onClick={() => setShowBulkDeleteModal(true)}
                  className="h-9 px-3 text-xs text-red-600 underline decoration-red-600/50 hover:bg-red-50 hover:text-red-700 hover:decoration-red-700 dark:text-red-400 dark:decoration-red-400/50 dark:hover:bg-red-950/30 dark:hover:text-red-300"
                >
                  {t('common.delete')}
                </Button>
              </>
            }
          />

          {filteredAndSorted.length === 0 ? (
            <ListEmptyState
              message={searchTerm ? t('matches.noMatch') : t('matches.noYet')}
              createLabel={!searchTerm ? t('matches.addMatch') : undefined}
              onCreate={
                !searchTerm ? () => attemptNavigation(() => openMatchPanel(null)) : undefined
              }
            />
          ) : (
            <div
              className={cn(
                'grid gap-3',
                columnCount === 1 && 'grid-cols-1',
                columnCount === 2 && 'grid-cols-1 sm:grid-cols-2',
                columnCount === 3 && 'grid-cols-1 sm:grid-cols-3',
              )}
            >
              {filteredAndSorted.map((match, index) => {
                const matchIsSelected = isSelected(match.id);
                return (
                  <MatchListItem
                    key={match.id}
                    match={match}
                    selected={matchIsSelected}
                    highlighted={recentlyDuplicatedMatchId === String(match.id)}
                    columnCount={columnCount}
                    onClick={() => handleOpenForView(match)}
                    checkbox={
                      <input
                        type="checkbox"
                        checked={matchIsSelected}
                        onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                        onChange={() => onVisibleRowCheckboxChange(match.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 cursor-pointer"
                        aria-label={matchIsSelected ? 'Unselect match' : 'Select match'}
                      />
                    }
                  />
                );
              })}
            </div>
          )}

          <ListFooterBar
            meta={
              <>
                Showing {filteredAndSorted.length} of {matches.length} Matches
              </>
            }
          />
        </div>
      </div>
    </div>
  );
}

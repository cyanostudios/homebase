import { ArrowDown, ArrowUp, Grid3x3, List, Settings, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useApp } from '@/core/api/AppContext';
import { BulkActionBar } from '@/core/ui/BulkActionBar';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import { useContentLayout } from '@/core/ui/ContentLayoutContext';
import { ContentToolbar } from '@/core/ui/ContentToolbar';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';

import { useMatches } from '../hooks/useMatches';
import type { Match } from '../types/match';

import { MatchSettingsView } from './MatchSettingsView';

const MATCHES_SETTINGS_KEY = 'matches';
type ViewMode = 'grid' | 'list';
type SortField = 'start_time' | 'home_team' | 'location' | 'updatedAt';
type SortOrder = 'asc' | 'desc';

export function MatchList() {
  const { t } = useTranslation();
  const {
    matches,
    matchesContentView,
    openMatchPanel: _openMatchPanel,
    openMatchForView,
    openMatchSettings,
    deleteMatch: _deleteMatch,
    deleteMatches,
    selectedMatchIds,
    toggleMatchSelected,
    selectAllMatches,
    clearMatchSelection,
    selectedCount,
    isSelected,
    recentlyDuplicatedMatchId,
  } = useMatches();
  const { getSettings, updateSettings, settingsVersion } = useApp();
  const { setHeaderTrailing } = useContentLayout();
  const { attemptNavigation } = useGlobalNavigationGuard();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('start_time');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [viewMode, setViewModeState] = useState<ViewMode>('list');
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    getSettings(MATCHES_SETTINGS_KEY)
      .then((settings: { viewMode?: ViewMode }) => {
        if (!cancelled) {
          setViewModeState(settings?.viewMode === 'grid' ? 'grid' : 'list');
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

  const visibleMatchIds = useMemo(() => filteredAndSorted.map((m) => m.id), [filteredAndSorted]);
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

  useEffect(() => {
    if (matchesContentView !== 'list') {
      setHeaderTrailing(null);
      return () => setHeaderTrailing(null);
    }
    setHeaderTrailing(
      <ContentToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder={t('matches.searchPlaceholder')}
        rightActions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              icon={Settings}
              onClick={() => openMatchSettings()}
              className="h-9 text-xs px-3"
              title={t('common.settings')}
            >
              {t('common.settings')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={Grid3x3}
              onClick={() => setViewMode('grid')}
              className={cn('h-9 text-xs px-3', viewMode === 'grid' && 'text-primary')}
            >
              Grid
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={List}
              onClick={() => setViewMode('list')}
              className={cn('h-9 text-xs px-3', viewMode === 'list' && 'text-primary')}
            >
              List
            </Button>
          </div>
        }
      />,
    );
    return () => setHeaderTrailing(null);
  }, [
    t,
    searchTerm,
    setSearchTerm,
    viewMode,
    setViewMode,
    setHeaderTrailing,
    openMatchSettings,
    matchesContentView,
  ]);

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
    return <MatchSettingsView />;
  }

  return (
    <div className="space-y-4 plugin-matches">
      {selectedCount > 0 && (
        <BulkActionBar
          selectedCount={selectedCount}
          onSelectAll={() => selectAllMatches(matches.map((m) => m.id))}
          onClearSelection={clearMatchSelection}
          actions={[
            {
              id: 'bulk-delete',
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

      {filteredAndSorted.length === 0 ? (
        <Card className="shadow-none p-6 text-center text-muted-foreground">
          {searchTerm
            ? 'No matches match your search.'
            : 'No matches yet. Click "Add match" to add one.'}
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredAndSorted.map((match) => {
            const selected = isSelected(match.id);
            return (
              <Card
                key={match.id}
                className={cn(
                  'relative p-5 cursor-pointer transition-all flex flex-col min-h-[140px] border-transparent bg-gray-50 dark:bg-gray-900/40',
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
                <div className="flex items-start justify-between mb-2">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleMatchSelected(match.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="cursor-pointer h-4 w-4"
                    aria-label={selected ? 'Deselect' : 'Select'}
                  />
                </div>
                <h3 className="font-semibold text-sm">
                  {match.home_team} – {match.away_team}
                </h3>
                <div className="text-xs text-muted-foreground mt-1">
                  {match.sport_type} · {match.format}
                  {match.total_minutes !== null && match.total_minutes !== undefined
                    ? ` · ${match.total_minutes} min`
                    : ''}
                </div>
                {match.location && (
                  <div className="text-xs text-muted-foreground truncate">{match.location}</div>
                )}
                <div className="text-[10px] text-muted-foreground mt-auto pt-2">
                  {formatDateTime(match.start_time)}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="shadow-none plugin-matches">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
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
                  className="cursor-pointer hover:bg-muted/50 select-none"
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
                <TableHead>Sport · Format</TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
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
                  className="cursor-pointer hover:bg-muted/50 select-none"
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
                  className="text-right cursor-pointer hover:bg-muted/50 select-none"
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
              {filteredAndSorted.map((match) => (
                <TableRow
                  key={match.id}
                  className={cn(
                    'cursor-pointer hover:bg-muted/50',
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
                  <TableCell className="w-12" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected(match.id)}
                      onChange={() => toggleMatchSelected(match.id)}
                      className="cursor-pointer h-4 w-4"
                      aria-label={isSelected(match.id) ? 'Unselect match' : 'Select match'}
                    />
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">
                      {match.home_team} – {match.away_team}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {match.sport_type} · {match.format}
                    {match.total_minutes !== null && match.total_minutes !== undefined
                      ? ` · ${match.total_minutes} min`
                      : ''}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {match.location || '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
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
    </div>
  );
}

import { Grid3x3, List, Settings, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

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

const MATCHES_SETTINGS_KEY = 'matches';
type ViewMode = 'grid' | 'list';
type SortField = 'start_time' | 'home_team' | 'updatedAt';
type SortOrder = 'asc' | 'desc';

export function MatchList() {
  const {
    matches,
    openMatchPanel,
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
  } = useMatches();
  const { getSettings, updateSettings, settingsVersion } = useApp();
  const { setHeaderTrailing } = useContentLayout();
  const { attemptNavigation } = useGlobalNavigationGuard();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, _setSortField] = useState<SortField>('start_time');
  const [sortOrder, _setSortOrder] = useState<SortOrder>('desc');
  const [viewMode, setViewModeState] = useState<ViewMode>('list');
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  const filteredAndSorted = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    const filtered = matches.filter((m) => {
      if (!needle) {
        return true;
      }
      return (
        (m.home_team ?? '').toLowerCase().includes(needle) ||
        (m.away_team ?? '').toLowerCase().includes(needle) ||
        (m.location ?? '').toLowerCase().includes(needle) ||
        (m.sport_type ?? '').toLowerCase().includes(needle)
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
  }, [matches, searchTerm, sortField, sortOrder]);

  const handleOpenForView = (match: Match) => attemptNavigation(() => openMatchForView(match));

  useEffect(() => {
    setHeaderTrailing(
      <ContentToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search by team, location..."
        rightActions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={Settings}
              onClick={() => openMatchSettings()}
              className="h-7 text-[10px] px-2"
              title="Settings"
            >
              Settings
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'default' : 'secondary'}
              size="sm"
              icon={Grid3x3}
              onClick={() => setViewMode('grid')}
              className="h-7 text-[10px] px-2"
            >
              Grid
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'secondary'}
              size="sm"
              icon={List}
              onClick={() => setViewMode('list')}
              className="h-7 text-[10px] px-2"
            >
              List
            </Button>
          </div>
        }
      />,
    );
    return () => setHeaderTrailing(null);
  }, [
    searchTerm,
    setSearchTerm,
    viewMode,
    setViewMode,
    setHeaderTrailing,
    openMatchSettings,
    openMatchPanel,
    attemptNavigation,
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
        itemLabel="matches"
        count={selectedCount}
        isDeleting={deleting}
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
                <TableHead className="w-8"></TableHead>
                <TableHead>Match</TableHead>
                <TableHead>Sport · Format</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Time</TableHead>
                <TableHead className="text-right">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSorted.map((match) => (
                <TableRow
                  key={match.id}
                  className={cn(
                    'cursor-pointer hover:bg-muted/50',
                    isSelected(match.id) && 'bg-plugin-subtle',
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
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected(match.id)}
                      onChange={() => toggleMatchSelected(match.id)}
                      className="cursor-pointer h-4 w-4"
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

import {
  CheckSquare,
  ArrowDown,
  ArrowUp,
  BarChart2,
  LayoutGrid,
  ListPlus,
  Plus,
  Search,
  Settings,
  Trash2,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import {
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { ListEmptyState } from '@/core/ui/ListEmptyState';
import { ListFilterStatCard } from '@/core/ui/ListFilterStatCard';
import { ListFooterBar } from '@/core/ui/ListFooterBar';
import { ListToolbar } from '@/core/ui/ListToolbar';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';

import { useTeams } from '../hooks/useTeams';
import { isTeamOnBreak, TEAM_GENDERS, type TeamGender, type TeamStatus } from '../types/teams';
import {
  getInitialTeamColumnCount,
  resolveTeamColumnCount,
  TEAMS_COLUMN_COUNT_STORAGE_KEY,
  TEAMS_SETTINGS_KEY,
  type TeamColumnCount,
} from '../utils/teamColumnCount';
import {
  compareTeamsByField,
  isTeamStringSortField,
  type TeamSortField,
  type TeamSortOrder,
} from '../utils/teamListSort';

import { TeamCard } from './TeamCard';
import { TeamsBulkCreateView } from './TeamsBulkCreateView';
import { TeamsSettingsView } from './TeamsSettingsView';
import { TeamsStatisticsView } from './TeamsStatisticsView';

type SortField = TeamSortField;
type SortOrder = TeamSortOrder;
type StatusFilter = 'all' | TeamStatus;
type GenderFilter = 'all' | TeamGender;

const SORT_FIELD_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'age_group', label: 'Age group' },
  { value: 'gender', label: 'Gender' },
  { value: 'status', label: 'Status' },
  { value: 'player_count', label: 'Players' },
  { value: 'updated_at', label: 'Updated' },
  { value: 'created_at', label: 'Created' },
];

const COLUMN_OPTIONS: TeamColumnCount[] = [1, 2, 3];

export function TeamList() {
  const { t } = useTranslation();
  const {
    teams,
    teamsContentView,
    openTeamPanel,
    openTeamSettings,
    closeTeamSettingsView,
    openTeamStatistics,
    closeTeamStatisticsView,
    openTeamBulkCreate,
    closeTeamBulkCreate,
    openTeamForView,
    selectedTeamIds,
    mergeIntoTeamSelection,
    selectAllTeams,
    clearTeamSelection,
    isSelected,
    toggleTeamSelected,
    deleteTeams,
    selectedCount,
    recentlyDuplicatedTeamId,
  } = useTeams();
  const { getSettings, updateSettings, settingsVersion } = useApp();
  const { attemptNavigation } = useGlobalNavigationGuard();
  const [search, setSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [activeSeason, setActiveSeason] = useState<string>('');
  const [primarySort, setPrimarySort] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [columnCount, setColumnCountState] = useState<TeamColumnCount>(getInitialTeamColumnCount);

  useEffect(() => {
    let cancelled = false;
    getSettings(TEAMS_SETTINGS_KEY)
      .then((settings: { activeSeason?: string; columnCount?: unknown }) => {
        if (cancelled) {
          return;
        }
        setActiveSeason(String(settings?.activeSeason || new Date().getFullYear()));
        const next = resolveTeamColumnCount(settings);
        setColumnCountState(next);
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(TEAMS_COLUMN_COUNT_STORAGE_KEY, String(next));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setActiveSeason(String(new Date().getFullYear()));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  const setColumnCount = useCallback(
    (count: TeamColumnCount) => {
      setColumnCountState(count);
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(TEAMS_COLUMN_COUNT_STORAGE_KEY, String(count));
      }
      updateSettings(TEAMS_SETTINGS_KEY, { columnCount: count }).catch(() => {});
    },
    [updateSettings],
  );

  const handlePrimarySortChange = (field: SortField) => {
    setPrimarySort(field);
    setSortOrder(isTeamStringSortField(field) || field === 'player_count' ? 'asc' : 'desc');
  };

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const filteredAndSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = teams.filter((team) => {
      if (genderFilter !== 'all' && team.gender !== genderFilter) {
        return false;
      }
      if (statusFilter === 'break') {
        if (!isTeamOnBreak(team)) {
          return false;
        }
      } else if (statusFilter !== 'all' && team.status !== statusFilter) {
        return false;
      }
      if (!q) {
        return true;
      }
      const genderLabel = team.gender ? t(`teams.gender.${team.gender}`) : '';
      return [team.name, team.age_group, genderLabel]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });

    return [...filtered].sort((a, b) => compareTeamsByField(a, b, primarySort, sortOrder));
  }, [teams, search, genderFilter, statusFilter, t, primarySort, sortOrder]);

  const stats = useMemo(() => {
    let active = 0;
    let breakCount = 0;
    let dormant = 0;
    for (const team of teams) {
      if (isTeamOnBreak(team)) {
        breakCount += 1;
      } else if (team.status === 'dormant') {
        dormant += 1;
      } else if (team.status === 'active') {
        active += 1;
      }
    }
    return { active, break: breakCount, dormant };
  }, [teams]);

  const genderCounts = useMemo(() => {
    const counts: Record<string, number> = { all: teams.length };
    for (const team of teams) {
      if (team.gender) {
        counts[team.gender] = (counts[team.gender] ?? 0) + 1;
      }
    }
    return counts;
  }, [teams]);

  const visibleIds = useMemo(() => filteredAndSorted.map((team) => team.id), [filteredAndSorted]);

  const { handleRowCheckboxShiftMouseDown, onVisibleRowCheckboxChange } =
    useShiftRangeListSelection({
      orderedVisibleIds: visibleIds,
      mergeIntoSelection: mergeIntoTeamSelection,
      toggleOne: toggleTeamSelected,
    });

  const allVisibleSelected = useMemo(
    () => visibleIds.length > 0 && visibleIds.every((id) => isSelected(id)),
    [visibleIds, isSelected],
  );

  const handleHeaderCheckboxChange = () => {
    if (allVisibleSelected) {
      clearTeamSelection();
    } else {
      selectAllTeams(visibleIds);
    }
  };

  if (teamsContentView === 'settings') {
    return (
      <div className="plugin-teams min-h-full bg-background">
        <div className="px-6 py-4">
          <TeamsSettingsView
            inlineTrailing={
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={X}
                className="h-9 px-3 text-xs"
                onClick={closeTeamSettingsView}
              >
                {t('common.close')}
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  if (teamsContentView === 'statistics') {
    return (
      <div className="plugin-teams min-h-full bg-background">
        <div className="px-6 py-4">
          <TeamsStatisticsView
            inlineTrailing={
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={X}
                className="h-9 px-3 text-xs"
                onClick={closeTeamStatisticsView}
              >
                {t('common.close')}
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  if (teamsContentView === 'bulk') {
    return (
      <div className="plugin-teams min-h-full bg-background">
        <div className="px-6 py-4">
          <TeamsBulkCreateView
            inlineTrailing={
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={X}
                className="h-9 px-3 text-xs"
                onClick={closeTeamBulkCreate}
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
    <div className="plugin-teams min-h-full bg-background px-6 py-4">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold tracking-tight">{t('nav.teams')}</h2>
            <p className="text-sm text-muted-foreground">
              {t('teams.listDescription', { count: teams.length, season: activeSeason })}
            </p>
          </div>
          <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              icon={Settings}
              className="h-9 px-2.5 text-xs"
              onClick={openTeamSettings}
              title={t('common.settings')}
            >
              {t('common.settings')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={BarChart2}
              className="h-9 px-2.5 text-xs"
              onClick={openTeamStatistics}
              title={t('common.statistics')}
            >
              {t('common.statistics')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={ListPlus}
              className="h-9 px-2.5 text-xs"
              onClick={openTeamBulkCreate}
              title={t('teams.bulkCreate')}
            >
              {t('teams.bulkCreate')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              className="h-9 px-3 text-xs"
              onClick={() => attemptNavigation(() => openTeamPanel(null))}
            >
              {t('teams.addTeam')}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <ListFilterStatCard
            label={t('teams.status.active')}
            value={stats.active}
            dotClassName="bg-emerald-500"
            active={statusFilter === 'active'}
            onClick={() => setStatusFilter(statusFilter === 'active' ? 'all' : 'active')}
          />
          <ListFilterStatCard
            label={t('teams.status.break')}
            value={stats.break}
            dotClassName="bg-orange-500"
            active={statusFilter === 'break'}
            onClick={() => setStatusFilter(statusFilter === 'break' ? 'all' : 'break')}
          />
          <ListFilterStatCard
            label={t('teams.status.dormant')}
            value={stats.dormant}
            dotClassName="bg-amber-500"
            active={statusFilter === 'dormant'}
            onClick={() => setStatusFilter(statusFilter === 'dormant' ? 'all' : 'dormant')}
          />
        </div>

        <div className="flex flex-wrap items-center gap-1 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setGenderFilter('all')}
            className={cn(
              genderFilter === 'all' ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span>
              {t('teams.filterAll')}{' '}
              <span className="tabular-nums font-semibold">({genderCounts.all})</span>
            </span>
          </Button>
          {TEAM_GENDERS.map((gender) => {
            const isActive = genderFilter === gender;
            return (
              <Button
                key={gender}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setGenderFilter(isActive ? 'all' : gender)}
                className={cn(isActive ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS)}
              >
                <Users className="h-3.5 w-3.5" />
                <span>
                  {t(`teams.gender.${gender}`)}{' '}
                  <span className="tabular-nums font-semibold">({genderCounts[gender] ?? 0})</span>
                </span>
              </Button>
            );
          })}
        </div>

        <BulkDeleteModal
          isOpen={showBulkDeleteModal}
          onClose={() => setShowBulkDeleteModal(false)}
          onConfirm={async () => {
            await deleteTeams(selectedTeamIds);
            setShowBulkDeleteModal(false);
          }}
          itemCount={selectedCount}
          itemLabel={selectedCount === 1 ? t('teams.itemSingular') : t('teams.itemPlural')}
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
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('teams.searchPlaceholder', { count: teams.length })}
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
                      aria-label={t(`teams.columns${count}`)}
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
                  onClick={clearTeamSelection}
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
              message={teams.length === 0 ? t('teams.noYet') : t('teams.noMatch')}
              createLabel={teams.length === 0 ? t('teams.addTeam') : undefined}
              onCreate={
                teams.length === 0 ? () => attemptNavigation(() => openTeamPanel(null)) : undefined
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
              {filteredAndSorted.map((team, index) => (
                <TeamCard
                  key={team.id}
                  team={team}
                  selected={isSelected(team.id)}
                  highlighted={recentlyDuplicatedTeamId === String(team.id)}
                  onClick={() => attemptNavigation(() => openTeamForView(team))}
                  columnCount={columnCount}
                  checkbox={
                    <input
                      type="checkbox"
                      checked={isSelected(team.id)}
                      onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                      onChange={() => onVisibleRowCheckboxChange(team.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 flex-shrink-0 cursor-pointer"
                    />
                  }
                />
              ))}
            </div>
          )}

          <ListFooterBar
            meta={t('teams.showingCount', {
              shown: filteredAndSorted.length,
              total: teams.length,
            })}
          />
        </div>
      </div>
    </div>
  );
}

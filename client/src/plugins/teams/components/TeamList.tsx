import { Plus, Search, Settings, Trash2, Users, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useApp } from '@/core/api/AppContext';
import { useShiftRangeListSelection } from '@/core/hooks/useShiftRangeListSelection';
import { BulkActionBar } from '@/core/ui/BulkActionBar';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';

import { useTeams } from '../hooks/useTeams';
import { isTeamOnBreak, type TeamStatus } from '../types/teams';

import { TeamCard } from './TeamCard';
import { TeamsSettingsView } from './TeamsSettingsView';

type StatusFilter = 'all' | TeamStatus;

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

export function TeamList() {
  const { t } = useTranslation();
  const {
    teams,
    teamsContentView,
    openTeamPanel,
    openTeamSettings,
    closeTeamSettingsView,
    openTeamForView,
    selectedTeamIds,
    mergeIntoTeamSelection,
    clearTeamSelection,
    isSelected,
    toggleTeamSelected,
    deleteTeams,
    selectedCount,
  } = useTeams();
  const { getSettings, settingsVersion } = useApp();
  const { attemptNavigation } = useGlobalNavigationGuard();
  const [search, setSearch] = useState('');
  const [ageGroupFilter, setAgeGroupFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [activeSeason, setActiveSeason] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    getSettings('teams')
      .then((settings: { activeSeason?: string }) => {
        if (!cancelled) {
          setActiveSeason(String(settings?.activeSeason || new Date().getFullYear()));
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

  const ageGroups = useMemo(() => {
    const groups = new Set<string>();
    for (const team of teams) {
      if (team.age_group) {
        groups.add(team.age_group);
      }
    }
    return Array.from(groups).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }),
    );
  }, [teams]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return teams.filter((team) => {
      if (ageGroupFilter !== 'all' && team.age_group !== ageGroupFilter) {
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
      return [team.name, team.age_group]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [teams, search, ageGroupFilter, statusFilter]);

  const stats = useMemo(
    () => ({
      active: teams.filter((team) => team.status === 'active').length,
      break: teams.filter((team) => isTeamOnBreak(team)).length,
      dormant: teams.filter((team) => team.status === 'dormant').length,
    }),
    [teams],
  );

  const visibleIds = useMemo(() => filtered.map((team) => team.id), [filtered]);

  const { handleRowCheckboxShiftMouseDown, onVisibleRowCheckboxChange } =
    useShiftRangeListSelection({
      orderedVisibleIds: visibleIds,
      mergeIntoSelection: mergeIntoTeamSelection,
      toggleOne: toggleTeamSelected,
    });

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

  return (
    <div className="plugin-teams min-h-full bg-background px-6 py-4">
      <div className="space-y-4">
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

        <div className="grid grid-cols-3 gap-3">
          <StatCard
            label={t('teams.status.active')}
            value={stats.active}
            dotClassName="bg-emerald-500"
            active={statusFilter === 'active'}
            onClick={() => setStatusFilter(statusFilter === 'active' ? 'all' : 'active')}
          />
          <StatCard
            label={t('teams.status.break')}
            value={stats.break}
            dotClassName="bg-orange-500"
            active={statusFilter === 'break'}
            onClick={() => setStatusFilter(statusFilter === 'break' ? 'all' : 'break')}
          />
          <StatCard
            label={t('teams.status.dormant')}
            value={stats.dormant}
            dotClassName="bg-amber-500"
            active={statusFilter === 'dormant'}
            onClick={() => setStatusFilter(statusFilter === 'dormant' ? 'all' : 'dormant')}
          />
        </div>

        {selectedCount > 0 && (
          <BulkActionBar
            selectedCount={selectedCount}
            onClearSelection={clearTeamSelection}
            actions={[
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
            await deleteTeams(selectedTeamIds);
            setShowBulkDeleteModal(false);
          }}
          itemCount={selectedCount}
          itemLabel={selectedCount === 1 ? t('teams.itemSingular') : t('teams.itemPlural')}
        />

        <Card className="rounded-xl border-0 overflow-visible bg-transparent shadow-none">
          <div className="mx-1 mt-1 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 dark:bg-slate-950">
            <div className="relative w-full max-w-sm md:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('teams.searchPlaceholder', { count: teams.length })}
                className="h-8 bg-background pl-9 text-xs"
              />
            </div>
            {ageGroups.length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                    ageGroupFilter === 'all'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                  onClick={() => setAgeGroupFilter('all')}
                >
                  {t('teams.filterAll')}
                </button>
                {ageGroups.map((group) => (
                  <button
                    key={group}
                    type="button"
                    className={cn(
                      'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                      ageGroupFilter === group
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                    onClick={() => setAgeGroupFilter(ageGroupFilter === group ? 'all' : group)}
                  >
                    {group}
                  </button>
                ))}
              </div>
            )}
          </div>

          {filtered.length === 0 ? (
            <Card className="mt-4 shadow-none">
              <div className="flex flex-col items-center gap-2 p-10 text-center">
                <Users className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm font-medium">{t('teams.noMatchTitle')}</p>
                <p className="text-xs text-muted-foreground">
                  {teams.length === 0 ? t('teams.noYet') : t('teams.noMatch')}
                </p>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 px-1 pb-1 pt-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((team, index) => (
                <TeamCard
                  key={team.id}
                  team={team}
                  selected={isSelected(team.id)}
                  onClick={() => attemptNavigation(() => openTeamForView(team))}
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
          <div className="mx-1 mb-1 mt-3 rounded-xl bg-white px-4 py-2 text-xs text-muted-foreground dark:bg-slate-950">
            {t('teams.showingCount', { shown: filtered.length, total: teams.length })}
          </div>
        </Card>
      </div>
    </div>
  );
}

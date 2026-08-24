import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { isTeamOnBreak } from '@/plugins/teams/types/teams';

import { DashboardKpiCard } from './DashboardKpiCard';
import type { DashboardDataProps } from './dashboardTypes';
import { formatDate } from './dashboardUtils';

export function DashboardKpiSection({
  has,
  onPageChange,
  requests,
  tasks,
  matches,
  teams,
}: DashboardDataProps) {
  const { t } = useTranslation();
  const showRequests = has('requests');
  const showTasks = has('tasks');
  const showMatches = has('matches');
  const showTeams = has('teams');

  const openRequestCount = useMemo(
    () => requests.filter((r) => r.status === 'not started' || r.status === 'in progress').length,
    [requests],
  );
  const externalRequestCount = useMemo(
    () => requests.filter((r) => r.source === 'external').length,
    [requests],
  );

  const completedTaskCount = useMemo(
    () => tasks.filter((task) => task.status === 'completed').length,
    [tasks],
  );
  const activeTaskCount = useMemo(
    () =>
      tasks.filter((task) => task.status === 'not started' || task.status === 'in progress').length,
    [tasks],
  );

  const upcomingMatches = useMemo(() => {
    const now = new Date();
    return matches
      .filter((m) => m.start_time && new Date(m.start_time) > now)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }, [matches]);

  const teamStats = useMemo(() => {
    let activeCount = 0;
    let breakCount = 0;
    for (const team of teams) {
      if (isTeamOnBreak(team)) {
        breakCount += 1;
      } else if (team.status === 'active') {
        activeCount += 1;
      }
    }
    return { activeCount, breakCount };
  }, [teams]);

  if (!showRequests && !showTasks && !showMatches && !showTeams) {
    return null;
  }

  const nextMatch = upcomingMatches[0];
  const nextMatchDate = nextMatch ? formatDate(nextMatch.start_time) : '';

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
      {showRequests && (
        <DashboardKpiCard
          label={t('dashboard.kpi.openRequests')}
          mainValue={openRequestCount}
          subtext={
            externalRequestCount > 0
              ? t('dashboard.kpi.requestsSubtextExternal', {
                  total: requests.length,
                  external: externalRequestCount,
                })
              : t('dashboard.kpi.requestsSubtext', { total: requests.length })
          }
          pluginName="requests"
          onPageChange={onPageChange}
        />
      )}
      {showTasks && (
        <DashboardKpiCard
          label={t('dashboard.kpi.activeTasks')}
          mainValue={activeTaskCount}
          subtext={t('dashboard.kpi.tasksSubtext', {
            completed: completedTaskCount,
            total: tasks.length,
          })}
          pluginName="tasks"
          onPageChange={onPageChange}
        />
      )}
      {showMatches && (
        <DashboardKpiCard
          label={t('dashboard.kpi.upcomingMatches')}
          mainValue={upcomingMatches.length}
          subtext={
            nextMatch && nextMatchDate
              ? t('dashboard.kpi.nextMatch', { date: nextMatchDate })
              : t('dashboard.kpi.noUpcomingMatches')
          }
          pluginName="matches"
          onPageChange={onPageChange}
        />
      )}
      {showTeams && (
        <DashboardKpiCard
          label={t('dashboard.kpi.teamsTotal')}
          mainValue={teams.length}
          subtext={t('dashboard.kpi.teamsSubtext', {
            active: teamStats.activeCount,
            onBreak: teamStats.breakCount,
          })}
          pluginName="teams"
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}

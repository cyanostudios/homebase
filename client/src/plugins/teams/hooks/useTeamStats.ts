import { useMemo } from 'react';

import { useRequests } from '@/plugins/requests/hooks/useRequests';

import type { ResponsibleRole } from '../types/teams';
import { isTeamOnBreak } from '../types/teams';
import type { TeamStatsData } from '../types/teamStats';

import { useTeams } from './useTeams';

function isOpenRequest(status: string): boolean {
  return status === 'not started' || status === 'in progress';
}

export function useTeamStats(includeRequests: boolean): TeamStatsData {
  const { teams } = useTeams();
  const { requests } = useRequests();

  return useMemo(() => {
    const byStatus = { active: 0, dormant: 0, onBreak: 0 };
    const byGender = { boys: 0, girls: 0, mixed: 0, unknown: 0 };
    let totalPlayers = 0;
    let withSeriesTeams = 0;
    let withoutSeriesTeams = 0;
    let totalSeriesTeams = 0;
    let teamsWithoutResponsibles = 0;
    const ageGroupMap = new Map<string, number>();
    const roleMap = new Map<string, number>();

    for (const team of teams) {
      if (isTeamOnBreak(team)) {
        byStatus.onBreak += 1;
      } else if (team.status === 'dormant') {
        byStatus.dormant += 1;
      } else {
        byStatus.active += 1;
      }

      if (team.gender === 'boys') {
        byGender.boys += 1;
      } else if (team.gender === 'girls') {
        byGender.girls += 1;
      } else if (team.gender === 'mixed') {
        byGender.mixed += 1;
      } else {
        byGender.unknown += 1;
      }

      totalPlayers += team.player_count ?? 0;

      const ageKey = team.age_group?.trim() || '';
      if (ageKey) {
        ageGroupMap.set(ageKey, (ageGroupMap.get(ageKey) ?? 0) + 1);
      }

      const seriesCount = team.series_teams?.length ?? team.series_team_count ?? 0;
      totalSeriesTeams += seriesCount;
      if (seriesCount > 0) {
        withSeriesTeams += 1;
      } else {
        withoutSeriesTeams += 1;
      }

      const responsibles = team.responsibles ?? [];
      if (responsibles.length === 0) {
        teamsWithoutResponsibles += 1;
      }
      for (const r of responsibles) {
        const role = (r.role || 'other') as ResponsibleRole;
        roleMap.set(role, (roleMap.get(role) ?? 0) + 1);
      }
    }

    const ageGroups = [...ageGroupMap.entries()]
      .map(([ageGroup, count]) => ({ ageGroup, count }))
      .sort((a, b) => b.count - a.count || a.ageGroup.localeCompare(b.ageGroup, 'sv'));

    const roleCounts = [...roleMap.entries()]
      .map(([role, count]) => ({ role, count }))
      .sort((a, b) => b.count - a.count);

    let requestsStats: TeamStatsData['requests'] = null;
    if (includeRequests) {
      const teamNameById = new Map(teams.map((t) => [Number(t.id), t.name]));
      const requestCounts = new Map<number, { open: number; total: number }>();
      let unlinked = 0;
      const requestByStatus = {
        notStarted: 0,
        inProgress: 0,
        completed: 0,
        cancelled: 0,
      };

      for (const req of requests) {
        if (req.status === 'not started') {
          requestByStatus.notStarted += 1;
        } else if (req.status === 'in progress') {
          requestByStatus.inProgress += 1;
        } else if (req.status === 'completed') {
          requestByStatus.completed += 1;
        } else if (req.status === 'cancelled') {
          requestByStatus.cancelled += 1;
        }

        if (req.teamId == null) {
          unlinked += 1;
          continue;
        }

        const entry = requestCounts.get(req.teamId) ?? { open: 0, total: 0 };
        entry.total += 1;
        if (isOpenRequest(req.status)) {
          entry.open += 1;
        }
        requestCounts.set(req.teamId, entry);
      }

      const topTeamsByOpenRequests = [...requestCounts.entries()]
        .map(([teamId, counts]) => ({
          teamId: String(teamId),
          teamName: teamNameById.get(teamId) ?? `#${teamId}`,
          openCount: counts.open,
          totalCount: counts.total,
        }))
        .filter((row) => row.openCount > 0)
        .sort((a, b) => b.openCount - a.openCount || b.totalCount - a.totalCount)
        .slice(0, 5);

      requestsStats = {
        total: requests.length,
        unlinked,
        byStatus: requestByStatus,
        topTeamsByOpenRequests,
      };
    }

    return {
      totalTeams: teams.length,
      byStatus,
      byGender,
      totalPlayers,
      ageGroups,
      withSeriesTeams,
      withoutSeriesTeams,
      totalSeriesTeams,
      teamsWithoutResponsibles,
      roleCounts,
      requests: requestsStats,
    };
  }, [teams, requests, includeRequests]);
}

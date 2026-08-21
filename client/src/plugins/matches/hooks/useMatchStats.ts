import { useMemo } from 'react';

import { useTeams } from '@/plugins/teams/hooks/useTeams';
import { formatTeamLabel } from '@/plugins/teams/utils/formatTeamLabel';

import type { MatchStatsData } from '../types/matchStats';
import { computeMatchStats } from '../utils/matchStats';

import { useMatches } from './useMatches';

/** Aggregate match record stats. Pass trimmed defaultHomeTeam from settings. */
export function useMatchStats(defaultHomeTeam: string): MatchStatsData {
  const { matches } = useMatches();
  const { teams } = useTeams();

  return useMemo(() => {
    const teamNameById = new Map(teams.map((t) => [String(t.id), formatTeamLabel(t) || t.name]));
    return computeMatchStats(matches, defaultHomeTeam, teamNameById);
  }, [matches, teams, defaultHomeTeam]);
}

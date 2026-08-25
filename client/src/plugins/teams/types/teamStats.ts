interface TeamRequestRank {
  teamId: string;
  teamName: string;
  openCount: number;
  totalCount: number;
}

interface AgeGroupCount {
  ageGroup: string;
  count: number;
}

interface RoleCount {
  role: string;
  count: number;
}

export interface PlayersByMonthPoint {
  monthKey: string;
  value: number;
}

export interface TeamStatsData {
  totalTeams: number;
  byStatus: {
    active: number;
    dormant: number;
    onBreak: number;
  };
  byGender: {
    boys: number;
    girls: number;
    mixed: number;
    unknown: number;
  };
  totalPlayers: number;
  /** Approximate monthly totals from player_count_history (edits over time). */
  playersByMonth: PlayersByMonthPoint[];
  ageGroups: AgeGroupCount[];
  withSeriesTeams: number;
  withoutSeriesTeams: number;
  totalSeriesTeams: number;
  teamsWithoutResponsibles: number;
  roleCounts: RoleCount[];
  requests: {
    total: number;
    unlinked: number;
    byStatus: {
      notStarted: number;
      inProgress: number;
      completed: number;
      cancelled: number;
    };
    topTeamsByOpenRequests: TeamRequestRank[];
  } | null;
}

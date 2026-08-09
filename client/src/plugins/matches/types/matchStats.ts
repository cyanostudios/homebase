/** Aggregated record metrics for a set of counted matches. */
export interface MatchRecordMetrics {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  /** Integer percent 0–100 (wins / played); 0 when played is 0. */
  winPercent: number;
  /** 3 for win, 1 for draw, 0 for loss. */
  points: number;
}

export interface MatchSideSplit {
  total: MatchRecordMetrics;
  home: MatchRecordMetrics;
  away: MatchRecordMetrics;
}

export interface MatchYearStats {
  year: number;
  sides: MatchSideSplit;
}

export interface MatchTeamStatsBlock {
  teamId: string;
  teamName: string;
  years: MatchYearStats[];
  /** All-time for this team across counted matches. */
  overall: MatchSideSplit;
}

export interface MatchStatsData {
  /** False when defaultHomeTeam is empty — club aggregates are empty. */
  hasDefaultHomeTeam: boolean;
  club: {
    years: MatchYearStats[];
    overall: MatchSideSplit;
  };
  teams: MatchTeamStatsBlock[];
}

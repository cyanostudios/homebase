export type MatchSeriesStandingSource = 'fogis' | 'derived' | 'none';

export interface MatchSeriesStandingRow {
  position: number | null;
  teamId: string | null;
  teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  isOwnClub: boolean;
}

export interface MatchSeriesCompetition {
  competitionId: number | null;
  competitionNumber: string | null;
  name: string | null;
  seasonId: number | null;
  isActive: boolean;
  competitionTypeName: string | null;
  categoryName: string | null;
  statusName: string | null;
  standingsSource: MatchSeriesStandingSource;
  standings: MatchSeriesStandingRow[];
}

export interface MatchSeriesMatchRow {
  id: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  result: string | null;
  competition_name: string | null;
  start_time: string;
  is_canceled: boolean;
  is_finished: boolean;
  is_postponed: boolean;
}

export interface MatchSeriesResponse {
  teamId: string;
  teamName: string;
  externalTeamId: string;
  fogisTeamName: string | null;
  competitions: MatchSeriesCompetition[];
  matches: MatchSeriesMatchRow[];
}

// client/src/plugins/profixio/types/profixio.ts

export interface ProfixioMatch {
  id: string;
  tournamentId: string | null;
  number: string | null;
  name: string;
  gameRound: number | null;
  date: string | null;
  time: string | null;
  datetimeStart: string | null;
  homeTeam: {
    teamRegistrationId: string | null;
    globalTeamId: string | null;
    name: string;
    goals: number | null;
    isWinner: boolean;
  };
  awayTeam: {
    teamRegistrationId: string | null;
    globalTeamId: string | null;
    name: string;
    goals: number | null;
    isWinner: boolean;
  };
  hasWinner: boolean;
  winnerTeam: string | null;
  field: {
    id: string;
    name: string;
    arena: {
      id: string;
      arenaName: string;
    } | null;
  } | null;
  matchCategory: {
    id: string;
    name: string;
    categoryCode: string;
  } | null;
  matchGroup: {
    id: string;
    displayName: string;
    name: string;
  } | null;
  matchUrl: string | null;
  matchDataUpdated: string | null;
  resultsUpdated: string | null;
  sets: Array<{ home: number; away: number }>;
  periodInfo: {
    periodLength: number;
    slotLength: number;
    numberOfPeriods: number;
    pauseLength: number;
    extraPeriodLength: number | null;
  } | null;
  isGroupPlay: boolean;
  isLeaguePlay: boolean;
  isPlayoff: boolean;
}

export interface ProfixioSeason {
  id: number;
  name: string;
  sportId: string;
  currentlyActive: boolean;
  seasonStartDate: string;
  seasonEndDate: string;
  registrationStartDate: string | null;
  registrationLastDate: string | null;
}

export interface ProfixioTournament {
  id: number;
  name: string;
  categoryId: number | null;
  categoryName: string | null;
  divisionId: number | null;
  divisionName: string | null;
  seasonId: number;
  matchCount: number;
  registrationTeamCount: number;
  matchCategories: Array<{
    id: number;
    name: string;
    categoryCode: string;
    matchGroups: Array<{
      id: number;
      displayName: string;
      name: string;
    }> | null;
  }>;
}

export interface ProfixioSettings {
  apiKey: string;
  defaultTeamFilter: string;
  defaultSeasonId: number | null;
  defaultTournamentId: number | null;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ProfixioMatchesResponse {
  data: ProfixioMatch[];
  pagination: {
    current_page: number;
    from: number | null;
    last_page: number;
    per_page: number;
    to: number | null;
    total: number;
  } | null;
  links: {
    first: string | null;
    last: string | null;
    prev: string | null;
    next: string | null;
  } | null;
}

export type SportType = 'football' | 'handball';

export const SPORT_TYPES: SportType[] = ['football', 'handball'];

export const FORMATS_BY_SPORT: Record<SportType, string[]> = {
  football: ['3vs3', '5vs5', '7vs7', '8vs8', '9vs9', '11vs11'],
  handball: ['6vs6', '7vs7'],
};

export interface MatchMention {
  contactId: string;
  contactName: string;
  companyName?: string;
  position?: number;
  length?: number;
}

export interface Match {
  id: string;
  name: string | null;
  match_number: number | null;
  match_type: 'series' | 'cup' | 'friendly' | null;
  referee_count: number;
  map_link: string | null;
  home_team: string;
  away_team: string;
  location: string | null;
  start_time: string;
  sport_type: SportType;
  format: string | null;
  total_minutes: number | null;
  contact_id: string | null;
  team_id: string | null;
  external_id: string | null;
  is_external: boolean;
  external_source: string | null;
  home_score: number | null;
  away_score: number | null;
  result: string | null;
  competition_name: string | null;
  is_canceled: boolean;
  is_finished: boolean;
  is_postponed: boolean;
  mentions: MatchMention[];
  created_at: string;
  updated_at: string;
}

export interface MatchImportResult {
  imported: number;
  updated: number;
  errors: string[];
  teams: Array<{
    teamId: string;
    teamName: string;
    imported: number;
    updated: number;
    error?: string;
  }>;
}

export interface ValidationError {
  field: string;
  message: string;
}

export function getFormatsForSport(sport: SportType): string[] {
  return FORMATS_BY_SPORT[sport] ?? [];
}

export function parseResultToScores(result: string): { home: number; away: number } | null {
  const trimmed = result.trim();
  const match = trimmed.match(/^(\d+)\s*[-:–]\s*(\d+)$/);
  if (!match) {
    return null;
  }
  const home = Number.parseInt(match[1], 10);
  const away = Number.parseInt(match[2], 10);
  if (!Number.isFinite(home) || !Number.isFinite(away)) {
    return null;
  }
  return { home, away };
}

export function getMatchFormScoreFields(
  match: Pick<Match, 'result' | 'home_score' | 'away_score'>,
): { home_score: string; away_score: string; result: string } {
  let home_score =
    match.home_score !== null && match.home_score !== undefined ? String(match.home_score) : '';
  let away_score =
    match.away_score !== null && match.away_score !== undefined ? String(match.away_score) : '';
  const result = match.result?.trim() || '';

  if ((!home_score || !away_score) && result) {
    const parsed = parseResultToScores(result);
    if (parsed) {
      if (!home_score) {
        home_score = String(parsed.home);
      }
      if (!away_score) {
        away_score = String(parsed.away);
      }
    }
  }

  return {
    home_score,
    away_score,
    result: result || formatMatchScore(match) || '',
  };
}

export function formatMatchScore(
  match: Pick<Match, 'result' | 'home_score' | 'away_score'>,
): string | null {
  const resultText = match.result?.trim();
  if (resultText) {
    return resultText;
  }
  if (match.home_score != null && match.away_score != null) {
    return `${match.home_score}–${match.away_score}`;
  }
  return null;
}

export function hasMatchResult(
  match: Pick<Match, 'result' | 'home_score' | 'away_score' | 'is_finished'>,
): boolean {
  return Boolean(formatMatchScore(match)) || match.is_finished;
}

export type MatchDateTimeWeekday = 'long' | 'short';
export type MatchDateTimeMonth = 'long' | 'short';

export function formatMatchDateTime(
  startTime: string,
  locale: string,
  options?: { weekday?: MatchDateTimeWeekday; month?: MatchDateTimeMonth },
): string {
  if (!startTime) {
    return '';
  }
  const date = new Date(startTime);
  if (Number.isNaN(date.getTime())) {
    return startTime;
  }
  return date.toLocaleString(locale, {
    weekday: options?.weekday ?? 'short',
    day: 'numeric',
    month: options?.month ?? 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

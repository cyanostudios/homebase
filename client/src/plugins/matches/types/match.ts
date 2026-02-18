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
  home_team: string;
  away_team: string;
  location: string | null;
  start_time: string;
  sport_type: SportType;
  format: string;
  total_minutes: number | null;
  contact_id: string | null;
  mentions: MatchMention[];
  created_at: string;
  updated_at: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

export function getFormatsForSport(sport: SportType): string[] {
  return FORMATS_BY_SPORT[sport] ?? [];
}

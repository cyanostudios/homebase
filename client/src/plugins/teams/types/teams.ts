export type TeamStatus = 'active' | 'dormant' | 'break';
export type TeamGender = 'boys' | 'girls' | 'mixed';
export type TeamColor = 'green' | 'blue' | 'red' | 'purple' | 'orange' | 'teal' | 'white';
export type ResponsibleRole = 'coach' | 'team_leader' | 'parent_contact' | 'board_member' | 'other';

export interface TrainingTime {
  day: string;
  startTime: string;
  endTime: string;
  location: string;
}

export interface SeasonBreak {
  name: string;
  startDate: string;
  endDate: string;
}

export interface SeriesTeam {
  name: string;
  level?: string | null;
  color?: TeamColor | null;
}

/** Stable key for selects/responsibles: name if set, otherwise level. */
export function getSeriesTeamKey(seriesTeam: SeriesTeam): string {
  const name = seriesTeam.name.trim();
  if (name) {
    return name;
  }
  return seriesTeam.level?.trim() || '';
}

export function isSeriesTeamEntryFilled(seriesTeam: SeriesTeam): boolean {
  return Boolean(getSeriesTeamKey(seriesTeam));
}

export function getSeriesTeamForKey(
  team: { series_teams?: SeriesTeam[] },
  seriesTeamKey: string | null | undefined,
): SeriesTeam | null {
  const key = seriesTeamKey?.trim();
  if (!key) {
    return null;
  }
  return (team.series_teams || []).find((st) => getSeriesTeamKey(st) === key) ?? null;
}

export function getSeriesTeamColorForName(
  team: { series_teams?: SeriesTeam[] },
  seriesTeamKey: string | null | undefined,
): TeamColor | null {
  const match = getSeriesTeamForKey(team, seriesTeamKey);
  if (!match?.color || !TEAM_COLORS.includes(match.color)) {
    return null;
  }
  return match.color;
}

export interface SeriesTeamOption {
  value: string;
  label: string;
}

export function getDisplaySeriesTeams(
  seriesTeams: SeriesTeam[],
  seriesTeamCount = 0,
): SeriesTeam[] {
  const filled = seriesTeams.filter(isSeriesTeamEntryFilled);
  if (filled.length > 0) {
    return filled;
  }
  if (seriesTeamCount <= 0) {
    return [];
  }
  return Array.from({ length: seriesTeamCount }, (_, i) => ({
    name: `Serielag ${i + 1}`,
    level: null,
    color: null,
  }));
}

export function formatSeriesTeamLabel(seriesTeam: SeriesTeam): string {
  const name = seriesTeam.name.trim();
  const level = seriesTeam.level?.trim();
  if (name && level) {
    return `${name} · ${level}`;
  }
  if (name) {
    return name;
  }
  return level || '';
}

export function getSeriesTeamDisplayLabel(
  team: { series_teams?: SeriesTeam[] },
  seriesTeamKey: string | null | undefined,
): string | null {
  const key = seriesTeamKey?.trim();
  if (!key) {
    return null;
  }
  const match = getSeriesTeamForKey(team, key);
  if (match) {
    return formatSeriesTeamLabel(match);
  }
  return key;
}

export interface Responsible {
  contactId: string;
  role: ResponsibleRole | string;
  /** Name of the series team this responsible belongs to, or null for the whole team. */
  seriesTeam?: string | null;
}

/** mailto: link with all unique responsible emails; optional subject (e.g. team name). */
export function buildResponsiblesGroupMailto(
  responsibles: Responsible[],
  getEmail: (contactId: string) => string | null | undefined,
  subject?: string,
): string | null {
  const emails: string[] = [];
  const seen = new Set<string>();
  for (const responsible of responsibles) {
    const email = getEmail(responsible.contactId)?.trim();
    if (!email) {
      continue;
    }
    const key = email.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    emails.push(email);
  }
  if (emails.length === 0) {
    return null;
  }
  const base = `mailto:${emails.join(',')}`;
  const trimmedSubject = subject?.trim();
  if (!trimmedSubject) {
    return base;
  }
  return `${base}?subject=${encodeURIComponent(trimmedSubject)}`;
}

/** Dropdown options for responsibles — from named series teams or legacy count. */
export function getSeriesTeamOptions(team: {
  series_teams?: SeriesTeam[];
  series_team_count?: number;
}): SeriesTeamOption[] {
  const filled = (team.series_teams || []).filter(isSeriesTeamEntryFilled);
  if (filled.length > 0) {
    return filled.map((st) => ({
      value: getSeriesTeamKey(st),
      label: formatSeriesTeamLabel(st),
    }));
  }
  const count = team.series_team_count ?? 0;
  if (count <= 0) {
    return [];
  }
  return Array.from({ length: count }, (_, i) => {
    const name = `Serielag ${i + 1}`;
    return { value: name, label: name };
  });
}

export function responsibleKey(responsible: Responsible): string {
  return `${responsible.contactId}::${responsible.seriesTeam ?? ''}`;
}

export interface TeamNote {
  id: string;
  text: string;
  createdAt: string;
}

export function createTeamNoteId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export interface Team {
  id: string;
  name: string;
  age_group: string | null;
  gender: TeamGender | null;
  player_count: number;
  series_team_count: number;
  series_teams: SeriesTeam[];
  status: TeamStatus;
  status_note: string | null;
  team_notes: TeamNote[];
  training_times: TrainingTime[];
  season_breaks: SeasonBreak[];
  responsibles: Responsible[];
  color: TeamColor;
  created_at: string;
  updated_at: string;
}

export interface TeamValidationError {
  field: string;
  message: string;
}

export const TEAM_STATUSES: TeamStatus[] = ['active', 'dormant', 'break'];
export const TEAM_GENDERS: TeamGender[] = ['boys', 'girls', 'mixed'];
export const TEAM_COLORS: TeamColor[] = [
  'green',
  'blue',
  'red',
  'purple',
  'orange',
  'teal',
  'white',
];

export function isLightTeamColor(color: TeamColor): boolean {
  return color === 'white';
}

/** Text on team color gradients (avatars, header). */
export function teamColorGradientTextClass(color: TeamColor): string {
  return isLightTeamColor(color) ? 'text-slate-800 dark:text-slate-100' : 'text-white';
}
export const RESPONSIBLE_ROLES: ResponsibleRole[] = [
  'coach',
  'team_leader',
  'parent_contact',
  'board_member',
  'other',
];

export const WEEK_DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;
export type WeekDay = (typeof WEEK_DAYS)[number];

/** Gradient classes for team theme colors (cards, detail header, avatar icons). */
export const TEAM_COLOR_GRADIENTS: Record<TeamColor, string> = {
  green: 'from-emerald-600 to-emerald-800',
  blue: 'from-blue-600 to-blue-800',
  red: 'from-red-600 to-red-800',
  purple: 'from-purple-600 to-purple-800',
  orange: 'from-orange-500 to-orange-700',
  teal: 'from-teal-600 to-teal-800',
  white:
    'from-slate-100 to-white border border-slate-200 dark:from-slate-700 dark:to-slate-800 dark:border-slate-600',
};

/** Solid accent classes for the top color stripe on team cards. */
export const TEAM_COLOR_STRIPES: Record<TeamColor, string> = {
  green: 'bg-emerald-600',
  blue: 'bg-blue-600',
  red: 'bg-red-600',
  purple: 'bg-purple-600',
  orange: 'bg-orange-500',
  teal: 'bg-teal-600',
  white: 'bg-slate-300 dark:bg-slate-500',
};

/** Overview row background per series team color. */
export const SERIES_TEAM_ROW_STYLES: Record<TeamColor, string> = {
  green:
    'border-emerald-200/80 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
  blue: 'border-blue-200/80 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200',
  red: 'border-red-200/80 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200',
  purple:
    'border-purple-200/80 bg-purple-50 text-purple-900 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-200',
  orange:
    'border-orange-200/80 bg-orange-50 text-orange-900 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-200',
  teal: 'border-teal-200/80 bg-teal-50 text-teal-900 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-200',
  white:
    'border-slate-200/80 bg-white text-slate-900 dark:border-slate-600 dark:bg-slate-950/40 dark:text-slate-200',
};

/** Neutral pill badge when a series team has no theme color. */
export const SERIES_TEAM_BADGE_NEUTRAL_STYLE =
  'bg-muted text-muted-foreground dark:bg-slate-800 dark:text-slate-300';

/** Pill badge classes per series team color. */
export const SERIES_TEAM_BADGE_STYLES: Record<TeamColor, string> = {
  green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
  red: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300',
  orange: 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300',
  teal: 'bg-teal-100 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300',
  white: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

/** Pill badge classes per status. */
export const TEAM_STATUS_BADGES: Record<TeamStatus, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  dormant: 'bg-amber-100 text-amber-700',
  break: 'bg-gray-100 text-gray-600',
};

/** Pill badge classes per responsible role. */
export const RESPONSIBLE_ROLE_BADGES: Record<ResponsibleRole, string> = {
  coach: 'bg-emerald-100 text-emerald-700',
  team_leader: 'bg-blue-100 text-blue-700',
  parent_contact: 'bg-purple-100 text-purple-700',
  board_member: 'bg-orange-100 text-orange-700',
  other: 'bg-gray-100 text-gray-600',
};

export type SeasonBreakTiming = 'ongoing' | 'past' | 'upcoming';

export function parseDateOnly(dateStr: string): Date | null {
  const trimmed = dateStr?.trim();
  if (!trimmed) {
    return null;
  }
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    const parsed = new Date(trimmed);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** Whether a season break is ongoing, in the past, or upcoming (by calendar date). */
export function getSeasonBreakTiming(startDate: string, endDate: string): SeasonBreakTiming {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  if (!start || !end) {
    return 'upcoming';
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDay = new Date(start);
  startDay.setHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(0, 0, 0, 0);

  if (today > endDay) {
    return 'past';
  }
  if (today >= startDay && today <= endDay) {
    return 'ongoing';
  }
  return 'upcoming';
}

/** All season breaks that include today. */
export function getOngoingSeasonBreaks(seasonBreaks: SeasonBreak[]): SeasonBreak[] {
  return seasonBreaks.filter(
    (seasonBreak) => getSeasonBreakTiming(seasonBreak.startDate, seasonBreak.endDate) === 'ongoing',
  );
}

/** First season break that includes today, if any. */
export function getOngoingSeasonBreak(seasonBreaks: SeasonBreak[]): SeasonBreak | null {
  return getOngoingSeasonBreaks(seasonBreaks)[0] ?? null;
}

/** Status break or an ongoing season break by calendar date. */
export function isTeamOnBreak(team: {
  status?: TeamStatus | string;
  season_breaks?: SeasonBreak[];
}): boolean {
  if (team.status === 'break') {
    return true;
  }
  return getOngoingSeasonBreaks(team.season_breaks ?? []).length > 0;
}

/** Row styles for season breaks by timing. */
export const SEASON_BREAK_TIMING_STYLES: Record<SeasonBreakTiming, string> = {
  ongoing:
    'border-red-200/80 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200',
  past: 'border-border/40 bg-muted/30 text-muted-foreground opacity-50 italic dark:bg-muted/20',
  upcoming: 'border-border/60 bg-card',
};

/** Shared sizing for badges in the team gradient header (~25% smaller than the enlarged header badges). */
export const TEAM_HEADER_BADGE_CLASS = 'px-4 py-1.5 text-xs font-medium';

/** Season break badge on the team gradient header (ongoing break). */
export const SEASON_BREAK_HEADER_BADGE_CLASS =
  'inline-flex max-w-[11rem] flex-shrink-0 items-center truncate rounded-full bg-red-500/40 text-white';

import type { Match } from '../types/match';
import { parseResultToScores } from '../types/match';
import type {
  MatchRecordMetrics,
  MatchSideSplit,
  MatchStatsData,
  MatchTeamStatsBlock,
  MatchYearStats,
} from '../types/matchStats';

import { matchHomeTeamEqualsDefault } from './matchDefaultHomeTeam';

export type MatchStatsEligible = Pick<
  Match,
  | 'start_time'
  | 'home_team'
  | 'away_team'
  | 'home_score'
  | 'away_score'
  | 'result'
  | 'is_canceled'
  | 'is_postponed'
  | 'team_id'
>;

type Side = 'home' | 'away';

function emptyMetrics(): MatchRecordMetrics {
  return {
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    winPercent: 0,
    points: 0,
  };
}

function emptySideSplit(): MatchSideSplit {
  return {
    total: emptyMetrics(),
    home: emptyMetrics(),
    away: emptyMetrics(),
  };
}

function finalizeMetrics(m: MatchRecordMetrics): MatchRecordMetrics {
  m.goalDifference = m.goalsFor - m.goalsAgainst;
  m.winPercent = m.played === 0 ? 0 : Math.round((m.won / m.played) * 100);
  return m;
}

function finalizeSideSplit(split: MatchSideSplit): MatchSideSplit {
  finalizeMetrics(split.total);
  finalizeMetrics(split.home);
  finalizeMetrics(split.away);
  return split;
}

/** Resolve numeric scores; null when not countable. */
export function resolveMatchScores(
  match: Pick<Match, 'home_score' | 'away_score' | 'result'>,
): { home: number; away: number } | null {
  if (match.home_score != null && match.away_score != null) {
    const home = Number(match.home_score);
    const away = Number(match.away_score);
    if (Number.isFinite(home) && Number.isFinite(away)) {
      return { home, away };
    }
  }
  const resultText = match.result?.trim();
  if (resultText) {
    return parseResultToScores(resultText);
  }
  return null;
}

export function getMatchYear(startTime: string): number | null {
  if (!startTime) {
    return null;
  }
  const date = new Date(startTime);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.getFullYear();
}

/**
 * Match is countable when not canceled/postponed, has a year, and has resolvable scores.
 */
export function isMatchStatsEligible(match: MatchStatsEligible): boolean {
  if (match.is_canceled || match.is_postponed) {
    return false;
  }
  if (getMatchYear(match.start_time) == null) {
    return false;
  }
  return resolveMatchScores(match) != null;
}

/**
 * Club side for a match against defaultHomeTeam.
 * - home when home_team matches default
 * - away when away_team matches default (and home does not)
 * - null when neither side matches (excluded from club stats)
 */
export function resolveClubMatchSide(
  match: Pick<Match, 'home_team' | 'away_team'>,
  defaultHomeTeam: string,
): Side | null {
  const trimmed = defaultHomeTeam.trim();
  if (!trimmed) {
    return null;
  }
  const isHome = matchHomeTeamEqualsDefault(match.home_team, trimmed);
  if (isHome) {
    return 'home';
  }
  if (matchHomeTeamEqualsDefault(match.away_team, trimmed)) {
    return 'away';
  }
  return null;
}

/**
 * Per-team side: same defaultHomeTeam rule as Teams matches tab.
 * Caller must only use this when defaultHomeTeam is non-empty; empty default
 * cannot safely assign GF/GA (would treat every match as away).
 */
export function resolveTeamMatchSide(
  match: Pick<Match, 'home_team'>,
  defaultHomeTeam: string,
): Side {
  return matchHomeTeamEqualsDefault(match.home_team, defaultHomeTeam.trim()) ? 'home' : 'away';
}

function applyOutcome(metrics: MatchRecordMetrics, goalsFor: number, goalsAgainst: number): void {
  metrics.played += 1;
  metrics.goalsFor += goalsFor;
  metrics.goalsAgainst += goalsAgainst;
  if (goalsFor > goalsAgainst) {
    metrics.won += 1;
    metrics.points += 3;
  } else if (goalsFor === goalsAgainst) {
    metrics.drawn += 1;
    metrics.points += 1;
  } else {
    metrics.lost += 1;
  }
}

function recordMatch(
  split: MatchSideSplit,
  side: Side,
  goalsFor: number,
  goalsAgainst: number,
): void {
  applyOutcome(split.total, goalsFor, goalsAgainst);
  applyOutcome(side === 'home' ? split.home : split.away, goalsFor, goalsAgainst);
}

function ourGoals(
  side: Side,
  scores: { home: number; away: number },
): { goalsFor: number; goalsAgainst: number } {
  if (side === 'home') {
    return { goalsFor: scores.home, goalsAgainst: scores.away };
  }
  return { goalsFor: scores.away, goalsAgainst: scores.home };
}

type YearBucket = Map<number, MatchSideSplit>;

function getOrCreateYear(bucket: YearBucket, year: number): MatchSideSplit {
  let split = bucket.get(year);
  if (!split) {
    split = emptySideSplit();
    bucket.set(year, split);
  }
  return split;
}

function yearsFromBucket(bucket: YearBucket, overall: MatchSideSplit): MatchYearStats[] {
  finalizeSideSplit(overall);
  return [...bucket.entries()]
    .map(([year, sides]) => ({
      year,
      sides: finalizeSideSplit(sides),
    }))
    .sort((a, b) => b.year - a.year);
}

export function computeMatchStats(
  matches: MatchStatsEligible[],
  defaultHomeTeam: string,
  teamNameById: Map<string, string> = new Map(),
): MatchStatsData {
  const trimmedDefault = defaultHomeTeam.trim();
  const hasDefaultHomeTeam = trimmedDefault.length > 0;

  const clubYears: YearBucket = new Map();
  const clubOverall = emptySideSplit();

  const teamYears = new Map<string, YearBucket>();
  const teamOverall = new Map<string, MatchSideSplit>();

  for (const match of matches) {
    if (!isMatchStatsEligible(match)) {
      continue;
    }
    const year = getMatchYear(match.start_time);
    const scores = resolveMatchScores(match);
    if (year == null || scores == null) {
      continue;
    }

    if (hasDefaultHomeTeam) {
      const clubSide = resolveClubMatchSide(match, trimmedDefault);
      if (clubSide) {
        const { goalsFor, goalsAgainst } = ourGoals(clubSide, scores);
        recordMatch(getOrCreateYear(clubYears, year), clubSide, goalsFor, goalsAgainst);
        recordMatch(clubOverall, clubSide, goalsFor, goalsAgainst);
      }
    }

    // Per-team outcomes need a non-empty default to know which side is "ours".
    // Without it, do not aggregate (avoids silent mirrored W/D/L).
    if (!hasDefaultHomeTeam) {
      continue;
    }

    const teamId = match.team_id != null ? String(match.team_id) : '';
    if (teamId) {
      let yearBucket = teamYears.get(teamId);
      if (!yearBucket) {
        yearBucket = new Map();
        teamYears.set(teamId, yearBucket);
      }
      let overall = teamOverall.get(teamId);
      if (!overall) {
        overall = emptySideSplit();
        teamOverall.set(teamId, overall);
      }
      const teamSide = resolveTeamMatchSide(match, trimmedDefault);
      const { goalsFor, goalsAgainst } = ourGoals(teamSide, scores);
      recordMatch(getOrCreateYear(yearBucket, year), teamSide, goalsFor, goalsAgainst);
      recordMatch(overall, teamSide, goalsFor, goalsAgainst);
    }
  }

  const teams: MatchTeamStatsBlock[] = hasDefaultHomeTeam
    ? [...teamYears.keys()]
        .map((teamId) => {
          const overall = teamOverall.get(teamId) ?? emptySideSplit();
          const years = yearsFromBucket(teamYears.get(teamId) ?? new Map(), overall);
          return {
            teamId,
            teamName: teamNameById.get(teamId) ?? `#${teamId}`,
            years,
            overall,
          };
        })
        .filter((block) => block.overall.total.played > 0)
        .sort((a, b) => a.teamName.localeCompare(b.teamName, undefined, { sensitivity: 'base' }))
    : [];

  return {
    hasDefaultHomeTeam,
    club: {
      years: yearsFromBucket(clubYears, clubOverall),
      overall: finalizeSideSplit(clubOverall),
    },
    teams,
  };
}

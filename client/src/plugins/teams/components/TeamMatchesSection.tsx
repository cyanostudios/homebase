import { ChevronRight, Trophy } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import { matchesApi } from '@/plugins/matches/api/matchesApi';
import type { Match } from '@/plugins/matches/types/match';

function formatMatchDateTime(startTime: string, locale: string): string {
  if (!startTime) return '';
  const date = new Date(startTime);
  if (Number.isNaN(date.getTime())) return startTime;
  return date.toLocaleString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isUpcomingMatch(match: Match): boolean {
  const date = new Date(match.start_time);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() >= Date.now();
}

interface TeamMatchesSectionProps {
  teamId: string;
  compact?: boolean;
  onOpenMatch?: (match: Match) => void;
}

export function TeamMatchesSection({
  teamId,
  compact = false,
  onOpenMatch,
}: TeamMatchesSectionProps) {
  const { t, i18n } = useTranslation();
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    matchesApi
      .getMatchesByTeam(teamId)
      .then((data) => {
        if (!cancelled) setMatches(data);
      })
      .catch(() => {
        if (!cancelled) setMatches([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  const upcomingMatches = useMemo(
    () => matches.filter(isUpcomingMatch).sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [matches],
  );
  const pastMatches = useMemo(
    () =>
      matches
        .filter((match) => !isUpcomingMatch(match))
        .sort((a, b) => b.start_time.localeCompare(a.start_time)),
    [matches],
  );

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>;
  }

  if (compact) {
    const nextMatch = upcomingMatches[0];
    if (!nextMatch) {
      return (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <Trophy className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{t('teams.noUpcomingMatches')}</p>
        </div>
      );
    }

    return (
      <button
        type="button"
        onClick={() => onOpenMatch?.(nextMatch)}
        disabled={!onOpenMatch}
        className={cn(
          'flex w-full items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-3 text-left',
          onOpenMatch && 'cursor-pointer transition-opacity hover:opacity-80',
          !onOpenMatch && 'cursor-default',
        )}
      >
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('teams.nextMatch')}
          </p>
          <p className="truncate text-sm font-medium">
            {nextMatch.home_team} – {nextMatch.away_team}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {formatMatchDateTime(nextMatch.start_time, i18n.language)}
            {nextMatch.location ? ` · ${nextMatch.location}` : ''}
          </p>
        </div>
        {onOpenMatch ? (
          <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
        ) : null}
      </button>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <Trophy className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">{t('teams.noMatchesForTeam')}</p>
      </div>
    );
  }

  const renderMatchRow = (match: Match) => (
    <div
      key={match.id}
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2"
    >
      <button
        type="button"
        onClick={() => onOpenMatch?.(match)}
        disabled={!onOpenMatch}
        className={cn(
          'min-w-0 flex-1 text-left',
          onOpenMatch && 'cursor-pointer transition-opacity hover:opacity-80',
          !onOpenMatch && 'cursor-default',
        )}
      >
        <p className="truncate text-sm font-medium">
          {match.home_team} – {match.away_team}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {formatMatchDateTime(match.start_time, i18n.language)}
          {match.location ? ` · ${match.location}` : ''}
        </p>
      </button>
      {onOpenMatch ? (
        <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
      ) : null}
    </div>
  );

  return (
    <div className="space-y-4">
      {upcomingMatches.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('teams.upcomingMatches')}
          </p>
          {upcomingMatches.map(renderMatchRow)}
        </div>
      ) : null}
      {pastMatches.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('teams.pastMatches')}
          </p>
          {pastMatches.map(renderMatchRow)}
        </div>
      ) : null}
    </div>
  );
}

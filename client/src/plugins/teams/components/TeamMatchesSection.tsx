import { ChevronRight, Trophy } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/api/AppContext';
import { useTimeFormat } from '@/core/settings/useTimeFormat';
import {
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
  LIST_FILTER_CHIP_ROW_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { cn } from '@/lib/utils';
import { matchesApi } from '@/plugins/matches/api/matchesApi';
import { MatchQuickInfoDialog } from '@/plugins/matches/components/MatchQuickInfoDialog';
import { MatchStatusBadges } from '@/plugins/matches/components/MatchStatusBadges';
import {
  formatMatchDateTime,
  formatMatchScore,
  isMatchStarted,
  type Match,
} from '@/plugins/matches/types/match';
import { MATCHES_SETTINGS_KEY } from '@/plugins/matches/utils/matchColumnCount';
import { resolveMatchDefaultHomeTeam } from '@/plugins/matches/utils/matchDefaultHomeTeam';

import {
  groupTeamMatchesBySide,
  listPlayedMatchesByDate,
  listUpcomingMatchesByDate,
  type TeamMatchesViewMode,
} from '../utils/teamMatchSide';

function formatMatchTeamsLine(match: Match): string {
  const score = formatMatchScore(match);
  const teams = `${match.home_team} – ${match.away_team}`;
  return score ? `${teams} (${score})` : teams;
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
  const { getSettings, settingsVersion } = useApp();
  useTimeFormat();
  const [matches, setMatches] = useState<Match[]>([]);
  const [defaultHomeTeam, setDefaultHomeTeam] = useState('');
  const [viewMode, setViewMode] = useState<TeamMatchesViewMode>('byDate');
  const [isLoading, setIsLoading] = useState(true);
  const [viewingMatch, setViewingMatch] = useState<Match | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    getSettings(MATCHES_SETTINGS_KEY)
      .then((settings) => {
        if (!cancelled) {
          setDefaultHomeTeam(resolveMatchDefaultHomeTeam(settings));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDefaultHomeTeam('');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  const groups = useMemo(
    () => groupTeamMatchesBySide(matches, defaultHomeTeam),
    [matches, defaultHomeTeam],
  );

  const upcomingMatches = useMemo(
    () =>
      [...groups.upcomingHome, ...groups.upcomingAway].sort((a, b) =>
        a.start_time.localeCompare(b.start_time),
      ),
    [groups],
  );

  const matchesByDate = useMemo(() => listUpcomingMatchesByDate(matches), [matches]);
  const playedMatchesByDate = useMemo(() => listPlayedMatchesByDate(matches), [matches]);

  const handleOpenMatchPreview = (match: Match) => {
    if (!onOpenMatch) return;
    setViewingMatch(match);
  };

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
      <>
        <button
          type="button"
          onClick={() => handleOpenMatchPreview(nextMatch)}
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
            <p className="truncate text-sm font-medium">{formatMatchTeamsLine(nextMatch)}</p>
            <p className="truncate text-xs text-muted-foreground">
              {formatMatchDateTime(nextMatch.start_time, i18n.language)}
              {nextMatch.location ? ` · ${nextMatch.location}` : ''}
            </p>
          </div>
          {onOpenMatch ? (
            <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
          ) : null}
        </button>
        <MatchQuickInfoDialog
          isOpen={viewingMatch !== null}
          match={viewingMatch}
          onClose={() => setViewingMatch(null)}
          onOpenMatch={() => {
            if (!viewingMatch) return;
            onOpenMatch?.(viewingMatch);
            setViewingMatch(null);
          }}
        />
      </>
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
        onClick={() => handleOpenMatchPreview(match)}
        disabled={!onOpenMatch}
        className={cn(
          'min-w-0 flex-1 text-left',
          onOpenMatch && 'cursor-pointer transition-opacity hover:opacity-80',
          !onOpenMatch && 'cursor-default',
        )}
      >
        <p className="truncate text-sm font-medium">{formatMatchTeamsLine(match)}</p>
        <p className="truncate text-xs text-muted-foreground">
          {formatMatchDateTime(match.start_time, i18n.language)}
          {match.location ? ` · ${match.location}` : ''}
          {match.competition_name ? ` · ${match.competition_name}` : ''}
        </p>
        {match.is_canceled || match.is_postponed || match.is_finished || isMatchStarted(match) ? (
          <div className="mt-1">
            <MatchStatusBadges match={match} />
          </div>
        ) : null}
      </button>
      {onOpenMatch ? (
        <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
      ) : null}
    </div>
  );

  const renderGroup = (titleKey: string, groupMatches: Match[]) => {
    if (groupMatches.length === 0) {
      return null;
    }
    return (
      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t(titleKey)}
        </p>
        {groupMatches.map(renderMatchRow)}
      </div>
    );
  };

  return (
    <>
      <div className="space-y-4">
        <div className={LIST_FILTER_CHIP_ROW_CLASS}>
          <button
            type="button"
            className={cn(
              viewMode === 'byDate' ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
            )}
            aria-pressed={viewMode === 'byDate'}
            onClick={() => setViewMode('byDate')}
          >
            {t('teams.matchViewByDate')}
          </button>
          <button
            type="button"
            className={cn(
              viewMode === 'byPlayed' ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
            )}
            aria-pressed={viewMode === 'byPlayed'}
            onClick={() => setViewMode('byPlayed')}
          >
            {t('teams.matchViewByPlayed')}
          </button>
          <button
            type="button"
            className={cn(
              viewMode === 'bySide' ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
            )}
            aria-pressed={viewMode === 'bySide'}
            onClick={() => setViewMode('bySide')}
          >
            {t('teams.matchViewBySide')}
          </button>
        </div>

        {viewMode === 'byDate' ? (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('teams.upcomingMatchesByDate')}
            </p>
            {matchesByDate.length > 0 ? (
              matchesByDate.map(renderMatchRow)
            ) : (
              <p className="text-sm text-muted-foreground">{t('teams.noUpcomingMatches')}</p>
            )}
          </div>
        ) : viewMode === 'byPlayed' ? (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('teams.playedMatchesByDate')}
            </p>
            {playedMatchesByDate.length > 0 ? (
              playedMatchesByDate.map(renderMatchRow)
            ) : (
              <p className="text-sm text-muted-foreground">{t('teams.noPlayedMatches')}</p>
            )}
          </div>
        ) : (
          <>
            {renderGroup('teams.upcomingHomeMatches', groups.upcomingHome)}
            {renderGroup('teams.upcomingAwayMatches', groups.upcomingAway)}
            {renderGroup('teams.pastHomeMatches', groups.pastHome)}
            {renderGroup('teams.pastAwayMatches', groups.pastAway)}
          </>
        )}
      </div>
      <MatchQuickInfoDialog
        isOpen={viewingMatch !== null}
        match={viewingMatch}
        onClose={() => setViewingMatch(null)}
        onOpenMatch={() => {
          if (!viewingMatch) return;
          onOpenMatch?.(viewingMatch);
          setViewingMatch(null);
        }}
      />
    </>
  );
}

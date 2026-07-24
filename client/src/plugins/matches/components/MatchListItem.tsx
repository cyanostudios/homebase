import { CalendarDays, MapPin, Trophy } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { cn } from '@/lib/utils';

import { formatMatchDateTime, formatMatchScore, type Match } from '../types/match';

import { MatchStatusBadges } from './MatchStatusBadges';
import { MatchTeamBadge } from './MatchTeamBadge';

function MatchScoreBadge({ match }: { match: Match }) {
  const score = formatMatchScore(match);
  if (!score) {
    return null;
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold tabular-nums text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
      <Trophy className="h-3 w-3 flex-shrink-0" />
      {score}
    </span>
  );
}

export function MatchListItem({
  match,
  selected,
  highlighted,
  onClick,
  checkbox,
}: {
  match: Match;
  selected?: boolean;
  highlighted?: boolean;
  onClick: () => void;
  checkbox?: React.ReactNode;
}) {
  const { i18n } = useTranslation();
  const locale = i18n.language ?? 'sv-SE';

  const dateLabel = match.start_time
    ? formatMatchDateTime(match.start_time, locale, { weekday: 'short', month: 'short' })
    : null;

  const matchLabel = match.name?.trim() || `${match.home_team} \u2013 ${match.away_team}`;

  const vsLine = match.name?.trim() ? `${match.home_team} \u2013 ${match.away_team}` : null;

  const openOnKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <Card
      className={cn(
        'group cursor-pointer overflow-hidden p-0 transition-all',
        DETAIL_VIEW_CARD_CLASS,
        highlighted && 'bg-green-50 dark:bg-green-950/30',
        selected ? 'bg-plugin-subtle ring-1 border-plugin-subtle' : 'hover:shadow-md',
      )}
      onClick={(e) => {
        if (
          (e.target as HTMLElement).closest(
            'input[type="checkbox"], button, [role="combobox"], [data-radix-collection-item]',
          )
        ) {
          return;
        }
        onClick();
      }}
      onKeyDown={openOnKeyDown}
      data-list-item={JSON.stringify(match)}
      data-plugin-name="matches"
      role="button"
      tabIndex={0}
      aria-label={`Open match ${matchLabel}`}
    >
      <div className="flex flex-col gap-2 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {checkbox}
            <MatchStatusBadges match={match} />
            <MatchScoreBadge match={match} />
          </div>
          {match.sport_type || match.format ? (
            <span className="text-[10px] text-muted-foreground">
              {match.sport_type}
              {match.format ? ` \u00b7 ${match.format}` : ''}
            </span>
          ) : null}
        </div>

        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
          {matchLabel}
        </h3>

        {vsLine ? <p className="line-clamp-1 text-xs text-muted-foreground">{vsLine}</p> : null}

        {match.team_id ? (
          <div>
            <MatchTeamBadge teamId={match.team_id} />
          </div>
        ) : null}

        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 pt-0.5 text-xs text-muted-foreground">
          {dateLabel ? (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{dateLabel}</span>
            </span>
          ) : null}
          {match.location ? (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{match.location}</span>
            </span>
          ) : null}
          {match.competition_name ? (
            <span className="truncate">{match.competition_name}</span>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

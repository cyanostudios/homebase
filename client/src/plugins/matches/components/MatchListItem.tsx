import { CalendarDays, MapPin, Trophy, User } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useTimeFormat } from '@/core/settings/useTimeFormat';
import {
  DETAIL_VIEW_CARD_CLASS,
  DETAIL_LIST_ITEM_HOVER_CLASS,
  DETAIL_LIST_ITEM_TITLE_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { cn } from '@/lib/utils';

import { formatMatchDateTime, formatMatchScore, isMatchStarted, type Match } from '../types/match';
import type { MatchColumnCount } from '../utils/matchColumnCount';

import { MatchStatusBadges } from './MatchStatusBadges';
import { MatchTeamBadge } from './MatchTeamBadge';

const BADGE_CLASS = 'border-0 rounded-md px-2 py-0.5 text-xs font-semibold';

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

function MatchContactBadge({ match }: { match: Match }) {
  const { t } = useTranslation();
  const mentions = Array.isArray(match.mentions) ? match.mentions : [];
  if (mentions.length === 0 && !match.contact_id) {
    return null;
  }

  const first = mentions[0];
  const label =
    first?.companyName?.trim() || first?.contactName?.trim() || t('matches.contactAssigned');
  const extraCount = mentions.length > 1 ? mentions.length - 1 : 0;

  return (
    <Badge
      variant="outline"
      className={cn(
        BADGE_CLASS,
        'inline-flex max-w-[180px] items-center gap-1 bg-muted text-muted-foreground',
      )}
    >
      <User className="h-3 w-3 flex-shrink-0" aria-hidden />
      <span className="truncate">
        {label}
        {extraCount > 0 ? ` +${extraCount}` : ''}
      </span>
    </Badge>
  );
}

export function MatchListItem({
  match,
  selected,
  highlighted,
  onClick,
  checkbox,
  columnCount = 1,
}: {
  match: Match;
  selected?: boolean;
  highlighted?: boolean;
  onClick: () => void;
  checkbox?: React.ReactNode;
  /** When 1, meta sits on the top row; 2/3 keep meta below title. */
  columnCount?: MatchColumnCount;
}) {
  const { i18n } = useTranslation();
  useTimeFormat();
  const locale = i18n.language ?? 'sv-SE';

  const dateLabel = match.start_time
    ? formatMatchDateTime(match.start_time, locale, { weekday: 'short', month: 'short' })
    : null;

  const matchLabel = match.name?.trim() || `${match.home_team} \u2013 ${match.away_team}`;
  const isDimmedTitle =
    match.is_finished || match.is_canceled || match.is_postponed || isMatchStarted(match);

  const metaOnTop = columnCount === 1;
  const hasMeta = Boolean(dateLabel || match.location || match.competition_name);

  const metaRow = hasMeta ? (
    <div
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground',
        !metaOnTop && 'mt-0.5 pt-0.5',
      )}
    >
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
      {match.competition_name ? <span className="truncate">{match.competition_name}</span> : null}
    </div>
  ) : null;

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
        selected ? 'bg-plugin-subtle ring-1 border-plugin-subtle' : DETAIL_LIST_ITEM_HOVER_CLASS,
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
            {match.team_id ? <MatchTeamBadge teamId={match.team_id} /> : null}
            <MatchContactBadge match={match} />
            {metaOnTop ? metaRow : null}
          </div>
          {match.sport_type || match.format ? (
            <span className="text-[10px] text-muted-foreground">
              {match.sport_type}
              {match.format ? ` \u00b7 ${match.format}` : ''}
            </span>
          ) : null}
        </div>

        <h3
          className={cn(
            'line-clamp-2',
            DETAIL_LIST_ITEM_TITLE_CLASS,
            isDimmedTitle && 'italic text-muted-foreground/40',
          )}
        >
          {matchLabel}
        </h3>

        {!metaOnTop ? metaRow : null}
      </div>
    </Card>
  );
}

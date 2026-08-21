import { CalendarDays, ChevronRight, Trophy, Users } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { useTimeFormat } from '@/core/settings/useTimeFormat';
import {
  DETAIL_LIST_ITEM_HOVER_CLASS,
  DETAIL_LIST_ITEM_TITLE_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { cn } from '@/lib/utils';
import { formatMatchDateTime, type Match } from '@/plugins/matches/types/match';

import type { Team, TrainingTime } from '../types/teams';
import {
  TEAM_COLOR_GRADIENTS,
  TEAM_STATUS_BADGES,
  getDaysUntilTrainingAfterBreak,
  isTeamOnBreak,
  teamColorGradientTextClass,
  WEEK_DAYS,
} from '../types/teams';
import { formatTeamLabel } from '../utils/formatTeamLabel';
import type { TeamColumnCount } from '../utils/teamColumnCount';

import { TeamSeriesTeamBadges } from './TeamSeriesTeamBadges';
/** Picks the next training relative to today's weekday (wraps around the week). */
function getNextTraining(team: Team): TrainingTime | null {
  const trainings = (team.training_times || []).filter((t) => t.day);
  if (!trainings.length) {
    return null;
  }
  const todayIndex = (new Date().getDay() + 6) % 7; // Monday = 0
  let best: TrainingTime | null = null;
  let bestOffset = Number.MAX_SAFE_INTEGER;
  for (const training of trainings) {
    const dayIndex = WEEK_DAYS.indexOf(training.day as (typeof WEEK_DAYS)[number]);
    if (dayIndex < 0) {
      continue;
    }
    const offset = (dayIndex - todayIndex + 7) % 7;
    if (offset < bestOffset) {
      bestOffset = offset;
      best = training;
    }
  }
  return best ?? trainings[0];
}

function formatMatchTeamsLine(match: Match): string {
  return `${match.home_team} – ${match.away_team}`;
}

export function TeamCard({
  team,
  selected,
  highlighted,
  onClick,
  checkbox,
  columnCount = 1,
  nextMatch = null,
  active = false,
}: {
  team: Team;
  selected?: boolean;
  highlighted?: boolean;
  onClick: () => void;
  checkbox?: React.ReactNode;
  /** When 1, stats and next training sit near the top; 2/3 keep them below. */
  columnCount?: TeamColumnCount;
  nextMatch?: Match | null;
  active?: boolean;
}) {
  const { t, i18n } = useTranslation();
  useTimeFormat();
  const nextTraining = getNextTraining(team);
  const genderLabel = team.gender ? t(`teams.gender.${team.gender}`) : null;
  const onSeasonBreak = isTeamOnBreak(team);
  const daysUntilTrainingAfterBreak = getDaysUntilTrainingAfterBreak(team);
  const breakTrainingUrgent =
    daysUntilTrainingAfterBreak !== null && daysUntilTrainingAfterBreak < 7;
  const title = formatTeamLabel(team) || team.name;
  const metaLine =
    [
      team.name?.trim() && team.name.trim() !== title ? team.name.trim() : null,
      genderLabel,
      team.playing_format,
    ]
      .filter(Boolean)
      .join(' · ') || '—';
  const metaOnTop = columnCount === 1;
  const seriesTeamsMeta = <TeamSeriesTeamBadges team={team} />;

  const breakTrainingMeta =
    daysUntilTrainingAfterBreak !== null ? (
      <span
        className={cn(
          'inline-flex min-w-0 items-center gap-1.5',
          breakTrainingUrgent ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground',
        )}
      >
        <CalendarDays className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="truncate">
          {t('teams.trainingAfterBreak', { count: daysUntilTrainingAfterBreak })}
        </span>
      </span>
    ) : null;

  const nextMatchMeta = nextMatch ? (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-muted-foreground">
      <Trophy className="h-3.5 w-3.5 flex-shrink-0" />
      <span className="truncate">
        {t('teams.nextMatchMeta', {
          when: formatMatchDateTime(nextMatch.start_time, i18n.language),
          teams: formatMatchTeamsLine(nextMatch),
        })}
      </span>
    </span>
  ) : null;

  const nextTrainingMeta = nextTraining ? (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-muted-foreground">
      <CalendarDays className="h-3.5 w-3.5 flex-shrink-0" />
      <span className="truncate">
        {t('teams.nextTraining', {
          day: t(`teams.daysShort.${nextTraining.day}`),
          time: nextTraining.startTime,
        })}
        {nextTraining.location ? ` · ${nextTraining.location}` : ''}
      </span>
    </span>
  ) : null;

  const metaRow = (
    <div
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground',
        !metaOnTop && 'mt-0.5 pt-0.5',
      )}
    >
      <span className="inline-flex items-center gap-1.5">
        <Users className="h-3.5 w-3.5" />
        {t('teams.playerCount', { count: team.player_count })}
      </span>
      {seriesTeamsMeta}
      {breakTrainingMeta}
      {nextMatchMeta}
      {!breakTrainingMeta ? nextTrainingMeta : null}
    </div>
  );

  return (
    <Card
      className={cn(
        'group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-xl border-0 bg-white p-0 shadow-sm transition-all dark:bg-slate-950',
        highlighted && 'bg-green-50 dark:bg-green-950/30',
        selected
          ? 'bg-plugin-subtle ring-1 border-plugin-subtle'
          : cn('hover:border-plugin-subtle', DETAIL_LIST_ITEM_HOVER_CLASS),
        active && 'bg-primary/5 ring-1 ring-primary/40',
      )}
      aria-current={active ? 'true' : undefined}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
          return;
        }
        onClick();
      }}
      role="button"
    >
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            {checkbox}
            <div
              className={cn(
                'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-xs font-bold',
                TEAM_COLOR_GRADIENTS[team.color],
                teamColorGradientTextClass(team.color),
              )}
            >
              {(team.age_group || team.name).slice(0, 3).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h3 className={cn('truncate', DETAIL_LIST_ITEM_TITLE_CLASS)}>{title}</h3>
              <p className="truncate text-xs text-muted-foreground">{metaLine}</p>
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1.5">
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
                onSeasonBreak ? 'bg-orange-100 text-orange-700' : TEAM_STATUS_BADGES[team.status],
              )}
            >
              {onSeasonBreak ? t('teams.status.break') : t(`teams.status.${team.status}`)}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-plugin" />
          </div>
        </div>

        {metaOnTop ? metaRow : null}

        {!metaOnTop ? (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {t('teams.playerCount', { count: team.player_count })}
              </span>
              {seriesTeamsMeta}
            </div>

            {(breakTrainingMeta || nextMatchMeta || (!breakTrainingMeta && nextTrainingMeta)) && (
              <div className="mt-auto flex flex-col gap-1.5 border-t border-border/60 pt-2.5 text-xs">
                {breakTrainingMeta}
                {nextMatchMeta}
                {!breakTrainingMeta ? nextTrainingMeta : null}
              </div>
            )}
          </>
        ) : null}
      </div>
    </Card>
  );
}

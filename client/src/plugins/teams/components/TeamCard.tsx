import { CalendarDays, ChevronRight, Circle, Users } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import {
  DETAIL_LIST_ITEM_HOVER_CLASS,
  DETAIL_LIST_ITEM_TITLE_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { cn } from '@/lib/utils';

import type { Team, TrainingTime } from '../types/teams';
import type { TeamColumnCount } from '../utils/teamColumnCount';
import {
  TEAM_COLOR_GRADIENTS,
  TEAM_STATUS_BADGES,
  isTeamOnBreak,
  teamColorGradientTextClass,
  WEEK_DAYS,
} from '../types/teams';

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

export function TeamCard({
  team,
  selected,
  highlighted,
  onClick,
  checkbox,
  columnCount = 1,
}: {
  team: Team;
  selected?: boolean;
  highlighted?: boolean;
  onClick: () => void;
  checkbox?: React.ReactNode;
  /** When 1, stats and next training sit near the top; 2/3 keep them below. */
  columnCount?: TeamColumnCount;
}) {
  const { t } = useTranslation();
  const nextTraining = getNextTraining(team);
  const genderLabel = team.gender ? t(`teams.gender.${team.gender}`) : null;
  const onSeasonBreak = isTeamOnBreak(team);
  const metaLine =
    [team.age_group, genderLabel, team.playing_format].filter(Boolean).join(' · ') || '—';
  const metaOnTop = columnCount === 1;

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
      <span className="inline-flex items-center gap-1.5">
        <Circle className="h-3 w-3" />
        {t('teams.seriesTeamCount', { count: team.series_team_count })}
      </span>
      {nextTraining ? (
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate">
            {t('teams.nextTraining', {
              day: t(`teams.daysShort.${nextTraining.day}`),
              time: nextTraining.startTime,
            })}
            {nextTraining.location ? ` · ${nextTraining.location}` : ''}
          </span>
        </span>
      ) : null}
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
      )}
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
              <h3 className={cn('truncate', DETAIL_LIST_ITEM_TITLE_CLASS)}>{team.name}</h3>
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
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {t('teams.playerCount', { count: team.player_count })}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Circle className="h-3 w-3" />
                {t('teams.seriesTeamCount', { count: team.series_team_count })}
              </span>
            </div>

            {nextTraining ? (
              <div className="mt-auto border-t border-border/60 pt-2.5">
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {t('teams.nextTraining', {
                    day: t(`teams.daysShort.${nextTraining.day}`),
                    time: nextTraining.startTime,
                  })}
                  {nextTraining.location ? ` · ${nextTraining.location}` : ''}
                </span>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </Card>
  );
}

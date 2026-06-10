import { CalendarDays, ChevronRight, Circle, Users } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import type { Team, TrainingTime } from '../types/teams';
import {
  TEAM_COLOR_GRADIENTS,
  TEAM_COLOR_STRIPES,
  TEAM_STATUS_BADGES,
  teamColorGradientTextClass,
  WEEK_DAYS,
} from '../types/teams';

/** Picks the next training relative to today's weekday (wraps around the week). */
export function getNextTraining(team: Team): TrainingTime | null {
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
}: {
  team: Team;
  selected?: boolean;
  highlighted?: boolean;
  onClick: () => void;
  checkbox?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const nextTraining = getNextTraining(team);
  const genderLabel = team.gender ? t(`teams.gender.${team.gender}`) : null;

  return (
    <Card
      className={cn(
        'group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-xl border-0 bg-white p-0 shadow-sm transition-all dark:bg-slate-950',
        highlighted && 'bg-green-50 dark:bg-green-950/30',
        selected
          ? 'bg-plugin-subtle ring-1 border-plugin-subtle'
          : 'hover:border-plugin-subtle hover:shadow-md',
      )}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
          return;
        }
        onClick();
      }}
      role="button"
    >
      <div className={cn('h-1.5 w-full flex-shrink-0', TEAM_COLOR_STRIPES[team.color])} />
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
              <h3 className="truncate text-sm font-semibold leading-snug">{team.name}</h3>
              <p className="truncate text-xs text-muted-foreground">
                {[team.age_group, genderLabel].filter(Boolean).join(' · ') || '—'}
              </p>
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1.5">
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
                TEAM_STATUS_BADGES[team.status],
              )}
            >
              {t(`teams.status.${team.status}`)}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-plugin" />
          </div>
        </div>

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

        {nextTraining && (
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
        )}
      </div>
    </Card>
  );
}

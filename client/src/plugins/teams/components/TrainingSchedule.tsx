import { MapPin, Plus } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

import type { TeamColor, TrainingTime } from '../types/teams';
import { SERIES_TEAM_ROW_STYLES, WEEK_DAYS } from '../types/teams';

function getTrainingSlotClassName(teamColor?: TeamColor) {
  const colorStyles = teamColor ? SERIES_TEAM_ROW_STYLES[teamColor] : null;

  return cn(
    'flex w-full flex-col items-center gap-0.5 rounded-md border px-1.5 py-1.5',
    colorStyles ?? 'border-plugin-subtle/60 bg-background/80 text-foreground',
  );
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function getTrainingsForDay(trainingTimes: TrainingTime[], day: string): TrainingTime[] {
  return trainingTimes
    .filter((tt) => tt.day === day)
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
}

function TrainingTimeBlock({ training }: { training: TrainingTime }) {
  const timeLabel = training.endTime
    ? `${training.startTime}–${training.endTime}`
    : training.startTime;

  return (
    <div className="flex w-full min-w-0 flex-col items-center gap-0.5">
      <span className="truncate text-xs font-semibold leading-tight">{timeLabel}</span>
      {training.location ? (
        <span className="inline-flex max-w-full items-center gap-0.5 text-[10px] leading-tight opacity-75">
          <MapPin className="h-2.5 w-2.5 flex-shrink-0" />
          <span className="truncate">{training.location}</span>
        </span>
      ) : null}
    </div>
  );
}

export function TrainingSchedule({
  trainingTimes,
  teamColor,
  variant = 'overview',
}: {
  trainingTimes: TrainingTime[];
  teamColor?: TeamColor;
  /** overview: earliest time per day, corner badge if more; detailed: all slots as separate boxes */
  variant?: 'overview' | 'detailed';
}) {
  const { t } = useTranslation();
  const slotClassName = getTrainingSlotClassName(teamColor);

  return (
    <div className="grid grid-cols-7 gap-1.5 overflow-visible pt-1 pr-1">
      {WEEK_DAYS.map((day) => {
        const dayTrainings = getTrainingsForDay(trainingTimes, day);
        const hasTraining = dayTrainings.length > 0;
        const hasMoreTrainings = dayTrainings.length > 1;

        return (
          <div
            key={day}
            className={cn(
              'relative overflow-visible flex min-h-[72px] flex-col items-center gap-1 rounded-lg border p-2 text-center',
              hasTraining
                ? 'border-plugin-subtle bg-plugin-subtle'
                : 'border-transparent bg-muted/50',
            )}
          >
            {variant === 'overview' && hasMoreTrainings && (
              <span
                className="absolute -right-2 -top-2 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-white shadow-sm ring-2 ring-background"
                title={t('teams.view.moreTrainingsSameDay', { count: dayTrainings.length })}
              >
                <Plus className="h-2.5 w-2.5" strokeWidth={3} />
              </span>
            )}
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t(`teams.daysShort.${day}`)}
            </span>
            {!hasTraining ? (
              <span className="text-xs text-muted-foreground/50">—</span>
            ) : variant === 'overview' ? (
              <div className={slotClassName}>
                <TrainingTimeBlock training={dayTrainings[0]} />
              </div>
            ) : (
              <div className="flex w-full flex-col gap-1.5">
                {dayTrainings.map((training, index) => (
                  <div
                    key={`${day}-${training.startTime}-${training.endTime}-${index}`}
                    className={slotClassName}
                  >
                    <TrainingTimeBlock training={training} />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

import { MapPin } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import { SERIES_TEAM_ROW_STYLES } from '@/plugins/teams/types/teams';
import { buildTeamSlots } from '@/plugins/schedule/types/schedule';
import type { ScheduleSlot } from '@/plugins/schedule/types/schedule';

import type { DashboardDataProps } from './dashboardTypes';

const WEEKDAY_NAMES = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function groupSlotsByTime(slots: ScheduleSlot[]): ScheduleSlot[][] {
  const sorted = [...slots].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  const groups: ScheduleSlot[][] = [];
  let currentKey = '';
  for (const slot of sorted) {
    const key = `${slot.startTime}-${slot.endTime}`;
    if (key !== currentKey) {
      groups.push([slot]);
      currentKey = key;
    } else {
      groups[groups.length - 1].push(slot);
    }
  }
  return groups;
}

function SlotBlock({ slot }: { slot: ScheduleSlot }) {
  const { t } = useTranslation();
  const timeLabel = slot.endTime ? `${slot.startTime}–${slot.endTime}` : slot.startTime;
  const label = slot.teamId ? slot.teamName || slot.title : t('schedule.noTeam');
  const colorStyles = slot.teamColor ? SERIES_TEAM_ROW_STYLES[slot.teamColor] : null;

  return (
    <div
      className={cn(
        'flex min-w-[7rem] max-w-[10rem] flex-col items-start gap-0.5 rounded-md border px-2 py-1.5 text-left',
        colorStyles ?? 'border-plugin-subtle/30 bg-background/80 text-foreground',
      )}
    >
      <span className="text-xs font-semibold leading-tight tabular-nums">{timeLabel}</span>
      {label ? (
        <span className="truncate text-[10px] font-extrabold leading-tight opacity-90">
          {label}
        </span>
      ) : null}
      {slot.location ? (
        <span className="inline-flex max-w-full items-center gap-0.5 text-[10px] leading-tight opacity-75">
          <MapPin className="h-2.5 w-2.5 shrink-0" />
          <span className="truncate">{slot.location}</span>
        </span>
      ) : null}
    </div>
  );
}

export function DashboardTodaySchedule({ has, teams }: DashboardDataProps) {
  const { t } = useTranslation();

  const todaySlots = useMemo<ScheduleSlot[]>(() => {
    const todayName = WEEKDAY_NAMES[new Date().getDay()];
    const all = buildTeamSlots(teams, []);
    return all.filter((slot) => slot.day?.toLowerCase() === todayName);
  }, [teams]);

  const timeGroups = useMemo(() => groupSlotsByTime(todaySlots), [todaySlots]);

  if (!has('schedule') || !has('teams')) {
    return null;
  }

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-slate-950">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
        {t('dashboard.todaySchedule')}
      </p>
      {timeGroups.length === 0 ? (
        <p className="px-1 text-xs text-muted-foreground">{t('dashboard.noTrainingToday')}</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {timeGroups.map((group) => {
            const timeKey = `${group[0].startTime}-${group[0].endTime}`;
            return (
              <div key={timeKey} className="flex flex-wrap items-stretch gap-1.5">
                {group.map((slot, idx) => (
                  <SlotBlock key={`${timeKey}-${slot.teamName ?? ''}-${idx}`} slot={slot} />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import type { Team, TeamColor } from '@/plugins/teams/types/teams';

export interface ScheduleSlot {
  day: string;
  startTime: string;
  endTime: string;
  location: string;
  teamId?: string;
  teamName?: string;
  teamColor?: TeamColor;
  title?: string;
  trainingIndex: number;
}

export function buildTeamSlots(teams: Team[], teamFilter: string): ScheduleSlot[] {
  const filteredTeams =
    teamFilter === 'all' ? teams : teams.filter((team) => String(team.id) === teamFilter);

  return filteredTeams.flatMap((team) =>
    (team.training_times || [])
      .map((training, trainingIndex) => ({ training, trainingIndex }))
      .filter(({ training }) => training.day)
      .map(({ training, trainingIndex }) => ({
        day: training.day,
        startTime: training.startTime,
        endTime: training.endTime,
        location: training.location,
        teamId: team.id,
        teamName: team.name,
        teamColor: team.color,
        trainingIndex,
      })),
  );
}

export const GRID_SLOT_MINUTES = 30;
export const GRID_ROW_HEIGHT_PX = 28;

export interface ScheduleGridSettings {
  startHour: number;
  endHour: number;
}

export const DEFAULT_SCHEDULE_GRID_SETTINGS: ScheduleGridSettings = {
  startHour: 6,
  endHour: 22,
};

export const SCHEDULE_SETTINGS_KEY = 'schedule';

export function normalizeScheduleGridSettings(
  raw?: Partial<ScheduleGridSettings> | null,
): ScheduleGridSettings {
  const parseHour = (value: unknown, fallback: number) => {
    const num = Number(value);
    if (!Number.isFinite(num)) {
      return fallback;
    }
    return Math.min(23, Math.max(0, Math.floor(num)));
  };

  const startHour = parseHour(raw?.startHour, DEFAULT_SCHEDULE_GRID_SETTINGS.startHour);
  let endHour = parseHour(raw?.endHour, DEFAULT_SCHEDULE_GRID_SETTINGS.endHour);

  if (endHour <= startHour) {
    endHour = Math.min(24, startHour + 2);
  }
  if (endHour > 24) {
    endHour = 24;
  }
  if (endHour <= startHour) {
    return { ...DEFAULT_SCHEDULE_GRID_SETTINGS };
  }

  return { startHour, endHour };
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesToTime(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, totalMinutes));
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function getGridStartMinutes(settings: ScheduleGridSettings): number {
  return settings.startHour * 60;
}

export function getGridEndMinutes(settings: ScheduleGridSettings): number {
  return settings.endHour * 60;
}

export function getGridSlotCount(settings: ScheduleGridSettings): number {
  return (getGridEndMinutes(settings) - getGridStartMinutes(settings)) / GRID_SLOT_MINUTES;
}

export function getGridHeightPx(settings: ScheduleGridSettings): number {
  return getGridSlotCount(settings) * GRID_ROW_HEIGHT_PX;
}

export function getSlotDurationMinutes(slot: ScheduleSlot): number {
  const start = timeToMinutes(slot.startTime);
  const end = timeToMinutes(slot.endTime || slot.startTime);
  const duration = end - start;
  return duration > 0 ? duration : GRID_SLOT_MINUTES;
}

export function getSlotTopPx(slot: ScheduleSlot, settings: ScheduleGridSettings): number {
  const start = timeToMinutes(slot.startTime);
  const offset = start - getGridStartMinutes(settings);
  return (offset / GRID_SLOT_MINUTES) * GRID_ROW_HEIGHT_PX;
}

export function isSlotVisibleInGrid(slot: ScheduleSlot, settings: ScheduleGridSettings): boolean {
  const start = timeToMinutes(slot.startTime);
  const end = timeToMinutes(slot.endTime || slot.startTime);
  return end > getGridStartMinutes(settings) && start < getGridEndMinutes(settings);
}

export function getSlotHeightPx(slot: ScheduleSlot): number {
  const duration = getSlotDurationMinutes(slot);
  return (duration / GRID_SLOT_MINUTES) * GRID_ROW_HEIGHT_PX;
}

export function getSlotDragId(slot: ScheduleSlot): string {
  return `training-${slot.teamId}-${slot.trainingIndex}`;
}

export function getDropCellId(day: string, startMinutes: number): string {
  return `cell-${day}-${startMinutes}`;
}

export interface SlotLayout {
  slot: ScheduleSlot;
  colIndex: number;
  colCount: number;
}

function slotsOverlap(a: ScheduleSlot, b: ScheduleSlot): boolean {
  const aStart = timeToMinutes(a.startTime);
  const aEnd = timeToMinutes(a.endTime || a.startTime);
  const bStart = timeToMinutes(b.startTime);
  const bEnd = timeToMinutes(b.endTime || b.startTime);
  return aStart < bEnd && bStart < aEnd;
}

export function computeDayLayout(slots: ScheduleSlot[]): SlotLayout[] {
  if (!slots.length) {
    return [];
  }

  const sorted = [...slots].sort((a, b) => {
    const startDiff = timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
    if (startDiff !== 0) {
      return startDiff;
    }
    return timeToMinutes(a.endTime || a.startTime) - timeToMinutes(b.endTime || b.startTime);
  });

  const columnEnds: number[] = [];
  const assignments: { slot: ScheduleSlot; colIndex: number }[] = [];

  for (const slot of sorted) {
    const start = timeToMinutes(slot.startTime);
    const end = Math.max(start + GRID_SLOT_MINUTES, timeToMinutes(slot.endTime || slot.startTime));

    let colIndex = 0;
    while (colIndex < columnEnds.length && columnEnds[colIndex] > start) {
      colIndex++;
    }

    if (colIndex >= columnEnds.length) {
      columnEnds.push(end);
    } else {
      columnEnds[colIndex] = end;
    }

    assignments.push({ slot, colIndex });
  }

  return assignments.map(({ slot, colIndex }) => {
    const overlapping = assignments.filter(({ slot: other }) => slotsOverlap(slot, other));
    const colCount = Math.max(1, ...overlapping.map((item) => item.colIndex + 1));
    return { slot, colIndex, colCount };
  });
}

export type ScheduleTrainingDialogState =
  | { mode: 'create'; day: string; startMinutes: number }
  | { mode: 'edit'; slot: ScheduleSlot }
  | null;

import type { Team, TeamColor, TrainingTime } from '@/plugins/teams/types/teams';

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
  eventId?: string;
}

export const DEFAULT_SCHEDULE_ID = 'default';

export interface SchedulePlan {
  id: string;
  name: string;
  color: string;
  is_team_calendar: boolean;
  event_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface PlanEvent {
  id: string;
  schedule_id: string;
  title: string;
  event_type: 'recurring' | 'date_based';
  day: string | null;
  event_date: string | null;
  start_time: string;
  end_time: string;
  location: string;
  team_id: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SchedulePlanWithEvents extends SchedulePlan {
  events: PlanEvent[];
}

export function planEventToSlot(event: PlanEvent, teams: Team[]): ScheduleSlot {
  const team = event.team_id
    ? teams.find((item) => String(item.id) === String(event.team_id))
    : undefined;

  return {
    day: event.day ?? '',
    startTime: event.start_time,
    endTime: event.end_time,
    location: event.location ?? '',
    teamId: event.team_id ?? undefined,
    teamName: team?.name ?? event.title,
    teamColor: team?.color,
    title: event.title,
    eventId: event.id,
    trainingIndex: -1,
  };
}

export function buildPlanSlots(
  events: PlanEvent[],
  teams: Team[],
  teamFilter: string,
): ScheduleSlot[] {
  const slots = events
    .filter((event) => event.event_type === 'recurring' && event.day)
    .map((event) => planEventToSlot(event, teams));

  if (teamFilter === 'all') {
    return slots;
  }

  return slots.filter((slot) => String(slot.teamId) === teamFilter);
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

export interface ScheduleAppSettings extends ScheduleGridSettings {
  locks?: Record<string, boolean>;
  gridHours?: Record<string, ScheduleGridSettings>;
  /** @deprecated migrated to locks.default on load */
  locked?: boolean;
}

export const DEFAULT_SCHEDULE_GRID_SETTINGS: ScheduleGridSettings = {
  startHour: 6,
  endHour: 22,
};

export const DEFAULT_SCHEDULE_APP_SETTINGS: ScheduleAppSettings = {
  ...DEFAULT_SCHEDULE_GRID_SETTINGS,
  locks: {},
  gridHours: {},
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

export function normalizeScheduleAppSettings(
  raw?: Partial<ScheduleAppSettings> | null,
): ScheduleAppSettings {
  const grid = normalizeScheduleGridSettings(raw);
  const locks: Record<string, boolean> = { ...(raw?.locks ?? {}) };
  if (raw?.locked && locks[DEFAULT_SCHEDULE_ID] === undefined) {
    locks[DEFAULT_SCHEDULE_ID] = Boolean(raw.locked);
  }

  const gridHours: Record<string, ScheduleGridSettings> = {};
  if (raw?.gridHours && typeof raw.gridHours === 'object') {
    for (const [scheduleId, hours] of Object.entries(raw.gridHours)) {
      gridHours[scheduleId] = normalizeScheduleGridSettings(hours);
    }
  }

  return { ...grid, locks, gridHours };
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
  if (slot.eventId) {
    return `event-${slot.eventId}`;
  }
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

export function buildScheduleEventPayload(
  teamId: string,
  training: TrainingTime,
  teams: Pick<Team, 'id' | 'name'>[],
) {
  const team = teams.find((item) => String(item.id) === teamId);
  return {
    title: team?.name ?? 'Training',
    event_type: 'recurring' as const,
    day: training.day,
    start_time: training.startTime,
    end_time: training.endTime,
    location: training.location,
    team_id: teamId ? Number(teamId) : null,
  };
}

export type ScheduleTrainingDialogState =
  | { mode: 'create'; day: string; startMinutes: number }
  | { mode: 'edit'; slot: ScheduleSlot }
  | null;

import type { Team, TeamColor, TrainingTime } from '@/plugins/teams/types/teams';
import { formatTeamLabel } from '@/plugins/teams/utils/formatTeamLabel';

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
  /** When false, excluded from booked-time totals. Missing/undefined = counts. */
  countsTowardCapacity?: boolean;
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
  counts_toward_capacity?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface SchedulePlanWithEvents extends SchedulePlan {
  events: PlanEvent[];
}

/** Sentinel for schedule events without a team (Select value + payload). */
export const SCHEDULE_NO_TEAM_VALUE = '__none__';

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
    teamName: team ? formatTeamLabel(team) : undefined,
    teamColor: team?.color,
    title: event.title,
    eventId: event.id,
    trainingIndex: -1,
    countsTowardCapacity: event.counts_toward_capacity === false ? false : true,
  };
}

/** Selected team ids for schedule quick filter. Empty = show all teams. */
export type ScheduleTeamFilter = readonly string[];

export function buildPlanSlots(
  events: PlanEvent[],
  teams: Team[],
  teamFilter: ScheduleTeamFilter,
): ScheduleSlot[] {
  const slots = events
    .filter((event) => event.event_type === 'recurring' && event.day)
    .map((event) => planEventToSlot(event, teams));

  if (teamFilter.length === 0) {
    return slots;
  }

  const selected = new Set(teamFilter.map(String));
  return slots.filter(
    (slot) =>
      slot.teamId !== undefined && slot.teamId !== null && selected.has(String(slot.teamId)),
  );
}

export function buildTeamSlots(teams: Team[], teamFilter: ScheduleTeamFilter): ScheduleSlot[] {
  const selected = new Set(teamFilter.map(String));
  const filteredTeams =
    teamFilter.length === 0 ? teams : teams.filter((team) => selected.has(String(team.id)));

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
        teamName: formatTeamLabel(team),
        teamColor: team.color,
        trainingIndex,
        countsTowardCapacity: training.countsTowardCapacity === false ? false : true,
      })),
  );
}

/** Prefill team when adding a slot: only when exactly one team is selected. */
export function getPreferredTeamIdFromFilter(teamFilter: ScheduleTeamFilter): string | undefined {
  return teamFilter.length === 1 ? teamFilter[0] : undefined;
}

export function toggleScheduleTeamFilter(teamFilter: ScheduleTeamFilter, teamId: string): string[] {
  const id = String(teamId);
  if (teamFilter.includes(id)) {
    return teamFilter.filter((item) => item !== id);
  }
  return [...teamFilter, id];
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
  /** Per-schedule available hours for capacity / overbooking indicator */
  availableHours?: Record<string, number>;
  /**
   * Per-schedule, per-day ordered slot drag IDs for overlapping column placement.
   * Outer key = scheduleId | 'default', inner key = day, value = ordered slotDragIds.
   */
  columnOrders?: Record<string, Record<string, string[]>>;
  /** @deprecated migrated to locks.default on load */
  locked?: boolean;
}

export const DEFAULT_SCHEDULE_GRID_SETTINGS: ScheduleGridSettings = {
  startHour: 6,
  endHour: 22,
};

/** Rendered week-grid extent: always a full day; Visade tider only control the viewport. */
export const FULL_DAY_GRID_SETTINGS: ScheduleGridSettings = {
  startHour: 0,
  endHour: 24,
};

export const DEFAULT_SCHEDULE_APP_SETTINGS: ScheduleAppSettings = {
  ...DEFAULT_SCHEDULE_GRID_SETTINGS,
  locks: {},
  gridHours: {},
  availableHours: {},
  columnOrders: {},
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

  const availableHours: Record<string, number> = {};
  if (raw?.availableHours && typeof raw.availableHours === 'object') {
    for (const [scheduleId, value] of Object.entries(raw.availableHours)) {
      const num = Number(value);
      if (Number.isFinite(num) && num >= 0) {
        availableHours[scheduleId] = Math.min(168, Math.round(num * 100) / 100);
      }
    }
  }

  const columnOrders: Record<string, Record<string, string[]>> = {};
  if (raw?.columnOrders && typeof raw.columnOrders === 'object') {
    for (const [scheduleId, byDay] of Object.entries(raw.columnOrders)) {
      if (!byDay || typeof byDay !== 'object') {
        continue;
      }
      const dayOrders: Record<string, string[]> = {};
      for (const [day, order] of Object.entries(byDay)) {
        if (!Array.isArray(order)) {
          continue;
        }
        dayOrders[day] = order
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
          .slice(0, 200);
      }
      columnOrders[scheduleId] = dayOrders;
    }
  }

  return { ...grid, locks, gridHours, availableHours, columnOrders };
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

/** Viewport height for preferred Visade tider (e.g. 16–22) within a full-day grid. */
export function getPreferredViewportHeightPx(preferred: ScheduleGridSettings): number {
  return getGridHeightPx(preferred);
}

/** scrollTop so the preferred startHour is at the top of the viewport. */
export function getPreferredScrollTopPx(preferred: ScheduleGridSettings): number {
  const offsetMinutes =
    getGridStartMinutes(preferred) - getGridStartMinutes(FULL_DAY_GRID_SETTINGS);
  return (offsetMinutes / GRID_SLOT_MINUTES) * GRID_ROW_HEIGHT_PX;
}

export function getSlotDurationMinutes(slot: ScheduleSlot): number {
  const start = timeToMinutes(slot.startTime);
  const end = timeToMinutes(slot.endTime || slot.startTime);
  const duration = end - start;
  return duration > 0 ? duration : GRID_SLOT_MINUTES;
}

export function slotCountsTowardCapacity(slot: ScheduleSlot): boolean {
  return slot.countsTowardCapacity !== false;
}

export function computeScheduleStats(slots: ScheduleSlot[]): {
  totalMinutes: number;
  hours: number;
  minutes: number;
} {
  const totalMinutes = slots
    .filter(slotCountsTowardCapacity)
    .reduce((sum, slot) => sum + getSlotDurationMinutes(slot), 0);
  return {
    totalMinutes,
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
  };
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

export function slotsOverlap(a: ScheduleSlot, b: ScheduleSlot): boolean {
  const aStart = timeToMinutes(a.startTime);
  const aEnd = timeToMinutes(a.endTime || a.startTime);
  const bStart = timeToMinutes(b.startTime);
  const bEnd = timeToMinutes(b.endTime || b.startTime);
  return aStart < bEnd && bStart < aEnd;
}

function columnOrderIndex(order: string[] | undefined, slot: ScheduleSlot): number {
  if (!order?.length) {
    return Number.MAX_SAFE_INTEGER;
  }
  const index = order.indexOf(getSlotDragId(slot));
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

/** Swap two slot drag IDs in a day's column order, inserting missing IDs at the end. */
export function swapColumnOrder(
  daySlots: ScheduleSlot[],
  dayColumnOrder: string[] | undefined,
  slotA: ScheduleSlot,
  slotB: ScheduleSlot,
): string[] {
  const ids = daySlots.map(getSlotDragId);
  const order = (dayColumnOrder ?? []).filter((id) => ids.includes(id));
  for (const id of ids) {
    if (!order.includes(id)) {
      order.push(id);
    }
  }
  const idA = getSlotDragId(slotA);
  const idB = getSlotDragId(slotB);
  const i = order.indexOf(idA);
  const j = order.indexOf(idB);
  if (i < 0 || j < 0 || i === j) {
    return order;
  }
  const next = [...order];
  next[i] = idB;
  next[j] = idA;
  return next;
}

export function computeDayLayout(slots: ScheduleSlot[], dayColumnOrder?: string[]): SlotLayout[] {
  if (!slots.length) {
    return [];
  }

  const sorted = [...slots].sort((a, b) => {
    const startDiff = timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
    if (startDiff !== 0) {
      return startDiff;
    }
    const orderDiff = columnOrderIndex(dayColumnOrder, a) - columnOrderIndex(dayColumnOrder, b);
    if (orderDiff !== 0) {
      return orderDiff;
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
  noTeamTitle = 'No team',
) {
  const resolvedTeamId = !teamId || teamId === SCHEDULE_NO_TEAM_VALUE ? '' : teamId;
  const team = resolvedTeamId
    ? teams.find((item) => String(item.id) === resolvedTeamId)
    : undefined;
  return {
    title: team?.name ?? noTeamTitle,
    event_type: 'recurring' as const,
    day: training.day,
    start_time: training.startTime,
    end_time: training.endTime,
    location: training.location,
    team_id: resolvedTeamId ? Number(resolvedTeamId) : null,
    counts_toward_capacity: training.countsTowardCapacity === false ? false : true,
  };
}

export type ScheduleTrainingDialogState =
  | { mode: 'create'; day: string; startMinutes: number }
  | { mode: 'edit'; slot: ScheduleSlot }
  | { mode: 'copy'; slot: ScheduleSlot }
  | null;

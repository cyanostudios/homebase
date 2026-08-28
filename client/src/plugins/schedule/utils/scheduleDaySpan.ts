import { WEEK_DAYS } from '@/plugins/teams/types/teams';

export type WeekDay = (typeof WEEK_DAYS)[number];

/**
 * Desktop calendar viewport:
 * - 1 | 3 | 7 → time grid with that many weekday columns
 * - stacked → full-week list (same as mobile ScheduleWeekView)
 */
export type ScheduleDaySpan = 1 | 3 | 7 | 'stacked';

export const SCHEDULE_DAY_SPAN_GRID_OPTIONS: readonly (1 | 3 | 7)[] = [1, 3, 7];

export const SCHEDULE_DAY_SPAN_COMPANION_GRID_OPTIONS: readonly (1 | 3)[] = [1, 3];

/** Companion Panel never uses dense 7-day grid; coerce to stacked. */
export function coerceCompanionDaySpan(span: ScheduleDaySpan): ScheduleDaySpan {
  return span === 7 ? 'stacked' : span;
}

export const SCHEDULE_DAY_SPAN_STORAGE_KEY = 'schedule:daySpan';

export const DEFAULT_SCHEDULE_DAY_SPAN: ScheduleDaySpan = 7;

/** JS Date#getDay(): 0=Sunday … 6=Saturday → WEEK_DAYS keys. */
const JS_DAY_TO_WEEK_DAY: readonly WeekDay[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

export function isScheduleDaySpan(value: unknown): value is ScheduleDaySpan {
  return value === 1 || value === 3 || value === 7 || value === 'stacked';
}

export function isScheduleGridDaySpan(value: ScheduleDaySpan): value is 1 | 3 | 7 {
  return value === 1 || value === 3 || value === 7;
}

export function parseStoredScheduleDaySpan(raw: string | null): ScheduleDaySpan | null {
  if (raw === null || raw === '') {
    return null;
  }
  if (raw === 'stacked') {
    return 'stacked';
  }
  const asNumber = Number(raw);
  return asNumber === 1 || asNumber === 3 || asNumber === 7 ? asNumber : null;
}

export function getInitialScheduleDaySpan(): ScheduleDaySpan {
  if (typeof window === 'undefined') {
    return DEFAULT_SCHEDULE_DAY_SPAN;
  }
  return (
    parseStoredScheduleDaySpan(window.sessionStorage.getItem(SCHEDULE_DAY_SPAN_STORAGE_KEY)) ??
    DEFAULT_SCHEDULE_DAY_SPAN
  );
}

export function persistScheduleDaySpanSession(span: ScheduleDaySpan): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.sessionStorage.setItem(SCHEDULE_DAY_SPAN_STORAGE_KEY, String(span));
}

export function getTodayWeekDay(now: Date = new Date()): WeekDay {
  return JS_DAY_TO_WEEK_DAY[now.getDay()] ?? 'monday';
}

/**
 * Visible weekday columns for the schedule time grid.
 * Stacked view ignores this (always full week list). 1 / 3 = window from anchor; 7 = full week.
 */
export function resolveVisibleWeekDays(
  span: ScheduleDaySpan,
  anchorDay: WeekDay = getTodayWeekDay(),
): readonly WeekDay[] {
  if (span === 7 || span === 'stacked') {
    return WEEK_DAYS;
  }

  const startIndex = WEEK_DAYS.indexOf(anchorDay);
  if (startIndex < 0) {
    return WEEK_DAYS;
  }

  if (span === 1) {
    return [WEEK_DAYS[startIndex]];
  }

  return WEEK_DAYS.slice(startIndex, Math.min(startIndex + 3, WEEK_DAYS.length));
}

/**
 * Shift the viewport anchor within the same week.
 * Span 1 steps by 1 day; span 3 by 3 days; 7 and stacked cannot browse (returns null).
 * No wrap past Monday/Sunday.
 */
export function shiftScheduleAnchor(
  span: ScheduleDaySpan,
  anchorDay: WeekDay,
  direction: -1 | 1,
): WeekDay | null {
  if (!isScheduleGridDaySpan(span) || span === 7) {
    return null;
  }

  const index = WEEK_DAYS.indexOf(anchorDay);
  if (index < 0) {
    return null;
  }

  const nextIndex = index + direction * span;
  if (nextIndex < 0 || nextIndex >= WEEK_DAYS.length) {
    return null;
  }

  return WEEK_DAYS[nextIndex];
}

export function canShiftScheduleAnchor(
  span: ScheduleDaySpan,
  anchorDay: WeekDay,
  direction: -1 | 1,
): boolean {
  return shiftScheduleAnchor(span, anchorDay, direction) !== null;
}

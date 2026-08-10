import { WEEK_DAYS } from '@/plugins/teams/types/teams';

import {
  canShiftScheduleAnchor,
  getTodayWeekDay,
  isScheduleDaySpan,
  parseStoredScheduleDaySpan,
  resolveVisibleWeekDays,
  shiftScheduleAnchor,
} from '../scheduleDaySpan';

describe('scheduleDaySpan', () => {
  describe('isScheduleDaySpan / parseStoredScheduleDaySpan', () => {
    it('accepts 1, 3, 7, and stacked', () => {
      expect(isScheduleDaySpan(1)).toBe(true);
      expect(isScheduleDaySpan(3)).toBe(true);
      expect(isScheduleDaySpan(7)).toBe(true);
      expect(isScheduleDaySpan('stacked')).toBe(true);
      expect(isScheduleDaySpan(2)).toBe(false);
      expect(isScheduleDaySpan('7')).toBe(false);
    });

    it('parses session strings', () => {
      expect(parseStoredScheduleDaySpan('1')).toBe(1);
      expect(parseStoredScheduleDaySpan('3')).toBe(3);
      expect(parseStoredScheduleDaySpan('7')).toBe(7);
      expect(parseStoredScheduleDaySpan('stacked')).toBe('stacked');
      expect(parseStoredScheduleDaySpan('2')).toBeNull();
      expect(parseStoredScheduleDaySpan(null)).toBeNull();
      expect(parseStoredScheduleDaySpan('')).toBeNull();
    });
  });

  describe('getTodayWeekDay', () => {
    it('maps JS Sunday–Saturday to WEEK_DAYS keys', () => {
      expect(getTodayWeekDay(new Date(2026, 7, 10))).toBe('monday');
      expect(getTodayWeekDay(new Date(2026, 7, 9))).toBe('sunday');
      expect(getTodayWeekDay(new Date(2026, 7, 15))).toBe('saturday');
    });
  });

  describe('resolveVisibleWeekDays', () => {
    it('returns full week for span 7 and stacked', () => {
      expect(resolveVisibleWeekDays(7, 'wednesday')).toEqual(WEEK_DAYS);
      expect(resolveVisibleWeekDays('stacked', 'wednesday')).toEqual(WEEK_DAYS);
    });

    it('returns only the anchor day for span 1', () => {
      expect(resolveVisibleWeekDays(1, 'monday')).toEqual(['monday']);
      expect(resolveVisibleWeekDays(1, 'friday')).toEqual(['friday']);
      expect(resolveVisibleWeekDays(1, 'sunday')).toEqual(['sunday']);
    });

    it('returns anchor + up to two following days within the week for span 3', () => {
      expect(resolveVisibleWeekDays(3, 'monday')).toEqual(['monday', 'tuesday', 'wednesday']);
      expect(resolveVisibleWeekDays(3, 'friday')).toEqual(['friday', 'saturday', 'sunday']);
    });

    it('clamps span 3 at Sunday (no wrap)', () => {
      expect(resolveVisibleWeekDays(3, 'saturday')).toEqual(['saturday', 'sunday']);
      expect(resolveVisibleWeekDays(3, 'sunday')).toEqual(['sunday']);
    });
  });

  describe('shiftScheduleAnchor', () => {
    it('does not browse in full-week or stacked span', () => {
      expect(shiftScheduleAnchor(7, 'monday', 1)).toBeNull();
      expect(shiftScheduleAnchor('stacked', 'monday', 1)).toBeNull();
      expect(canShiftScheduleAnchor(7, 'monday', 1)).toBe(false);
      expect(canShiftScheduleAnchor('stacked', 'monday', 1)).toBe(false);
    });

    it('steps one day for span 1 and stops at week ends', () => {
      expect(shiftScheduleAnchor(1, 'monday', 1)).toBe('tuesday');
      expect(shiftScheduleAnchor(1, 'sunday', -1)).toBe('saturday');
      expect(shiftScheduleAnchor(1, 'monday', -1)).toBeNull();
      expect(shiftScheduleAnchor(1, 'sunday', 1)).toBeNull();
    });

    it('steps three days for span 3 and stops at week ends', () => {
      expect(shiftScheduleAnchor(3, 'monday', 1)).toBe('thursday');
      expect(resolveVisibleWeekDays(3, 'thursday')).toEqual(['thursday', 'friday', 'saturday']);
      expect(shiftScheduleAnchor(3, 'thursday', 1)).toBe('sunday');
      expect(shiftScheduleAnchor(3, 'sunday', 1)).toBeNull();
      expect(shiftScheduleAnchor(3, 'monday', -1)).toBeNull();
      expect(shiftScheduleAnchor(3, 'thursday', -1)).toBe('monday');
    });
  });
});

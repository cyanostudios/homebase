import type { ScheduleSlot } from '../../types/schedule';
import { computeScheduleStats } from '../../types/schedule';

function slot(startTime: string, endTime: string, countsTowardCapacity?: boolean): ScheduleSlot {
  return {
    day: 'monday',
    startTime,
    endTime,
    location: '',
    trainingIndex: 0,
    countsTowardCapacity,
  };
}

describe('computeScheduleStats', () => {
  it('sums durations into hours and minutes', () => {
    expect(computeScheduleStats([slot('17:00', '19:00'), slot('10:00', '10:30')])).toEqual({
      totalMinutes: 150,
      hours: 2,
      minutes: 30,
    });
  });

  it('excludes opted-out sessions', () => {
    expect(
      computeScheduleStats([
        slot('17:00', '19:00'),
        slot('10:00', '11:00', false),
        slot('12:00', '12:30', true),
      ]),
    ).toEqual({
      totalMinutes: 150,
      hours: 2,
      minutes: 30,
    });
  });

  it('returns zero when all sessions are opted out', () => {
    expect(computeScheduleStats([slot('17:00', '18:00', false)])).toEqual({
      totalMinutes: 0,
      hours: 0,
      minutes: 0,
    });
  });

  it('treats missing countsTowardCapacity as counting', () => {
    expect(computeScheduleStats([slot('08:00', '09:00')]).totalMinutes).toBe(60);
  });

  it('includes sessions regardless of typical grid visibility window', () => {
    // Capacity footer must sum full schedule — including early/late slots outside visible hours.
    expect(
      computeScheduleStats([slot('05:00', '06:00'), slot('22:00', '23:30'), slot('17:00', '18:00')])
        .totalMinutes,
    ).toBe(210);
  });
});

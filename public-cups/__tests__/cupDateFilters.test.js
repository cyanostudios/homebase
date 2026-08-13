const {
  parseCupDate,
  isUpcoming,
  cupMatchesDateFilter,
  timeBucket,
  monthKeyFromCup,
  currentMonthKey,
  selectableMonthKeysFromCup,
} = require('../lib/cupDateFilters');

describe('Cupappen cupDateFilters', () => {
  const now = new Date(2026, 7, 13, 15, 30, 0); // 13 Aug 2026 local

  it('parses YYYY-MM-DD as local calendar day', () => {
    const d = parseCupDate('2026-08-29');
    expect(d).toBeTruthy();
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7);
    expect(d.getDate()).toBe(29);
  });

  it('parses timestamp prefixes without shifting the calendar day', () => {
    const d = parseCupDate('2026-01-09 00:00:00+00');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(9);
  });

  it('upcoming uses end_date and keeps cups that end today', () => {
    expect(isUpcoming({ start_date: '2026-08-01', end_date: '2026-08-13' }, now)).toBe(true);
    expect(isUpcoming({ start_date: '2026-08-01', end_date: '2026-08-12' }, now)).toBe(false);
    expect(isUpcoming({ start_date: '2026-09-27', end_date: '2026-09-27' }, now)).toBe(true);
  });

  it('cups without dates are not upcoming', () => {
    expect(isUpcoming({ start_date: null, end_date: null }, now)).toBe(false);
    expect(cupMatchesDateFilter({ start_date: null }, 'upcoming', now)).toBe(false);
  });

  it('ongoing multi-month cup buckets to this month', () => {
    expect(timeBucket({ start_date: '2026-05-01', end_date: '2026-09-30' }, now)).toBe(
      'Den här månaden',
    );
    expect(timeBucket({ start_date: '2026-08-29', end_date: '2026-08-29' }, now)).toBe(
      'Den här månaden',
    );
    expect(timeBucket({ start_date: '2026-09-27', end_date: '2026-09-27' }, now)).toBe('Kommande');
  });

  it('monthKeyFromCup uses start date month', () => {
    expect(monthKeyFromCup({ start_date: '2026-09-27' })).toBe('2026-09');
  });

  it('currentMonthKey matches local calendar month', () => {
    expect(currentMonthKey(now)).toBe('2026-08');
  });

  it('selectableMonthKeysFromCup omits past months and keeps current+future with cups', () => {
    expect(
      selectableMonthKeysFromCup({ start_date: '2026-05-01', end_date: '2026-05-03' }, now),
    ).toEqual([]);
    expect(
      selectableMonthKeysFromCup({ start_date: '2026-08-20', end_date: '2026-08-21' }, now),
    ).toEqual(['2026-08']);
    expect(
      selectableMonthKeysFromCup({ start_date: '2026-05-01', end_date: '2026-09-15' }, now),
    ).toEqual(['2026-08', '2026-09']);
    expect(
      selectableMonthKeysFromCup({ start_date: '2026-10-01', end_date: '2026-10-02' }, now),
    ).toEqual(['2026-10']);
  });
});

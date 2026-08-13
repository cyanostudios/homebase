const { clampPageviewDays, fillPageviewSeries, formatDayKey } = require('../pageviewStats');

describe('clampPageviewDays', () => {
  test('defaults to 30', () => {
    expect(clampPageviewDays(undefined)).toBe(30);
    expect(clampPageviewDays('')).toBe(30);
    expect(clampPageviewDays('nope')).toBe(30);
  });

  test('clamps to 1–90', () => {
    expect(clampPageviewDays(0)).toBe(1);
    expect(clampPageviewDays(7)).toBe(7);
    expect(clampPageviewDays(90)).toBe(90);
    expect(clampPageviewDays(999)).toBe(90);
  });
});

describe('fillPageviewSeries', () => {
  test('fills missing days with zero and keeps length', () => {
    const end = new Date(2026, 7, 13); // 2026-08-13 local
    const series = fillPageviewSeries(
      7,
      [
        { day: '2026-08-13', views: 5 },
        { day: '2026-08-10', views: 2 },
      ],
      { endDate: end },
    );
    expect(series).toHaveLength(7);
    expect(series[0].day).toBe('2026-08-07');
    expect(series[0].views).toBe(0);
    expect(series[3]).toEqual({ day: '2026-08-10', views: 2 });
    expect(series[6]).toEqual({ day: '2026-08-13', views: 5 });
  });

  test('accepts Date day values', () => {
    const end = new Date(2026, 0, 5);
    const series = fillPageviewSeries(3, [{ day: new Date(2026, 0, 4), views: 9 }], {
      endDate: end,
    });
    expect(series.map((p) => p.day)).toEqual(['2026-01-03', '2026-01-04', '2026-01-05']);
    expect(series[1].views).toBe(9);
    expect(series[0].views).toBe(0);
  });

  test('formatDayKey pads month and day', () => {
    expect(formatDayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

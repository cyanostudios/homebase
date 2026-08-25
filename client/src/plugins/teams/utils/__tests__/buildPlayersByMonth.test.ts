import { buildPlayersByMonth, formatPlayersMonthLabel } from '../buildPlayersByMonth';

describe('buildPlayersByMonth', () => {
  it('returns empty for no teams', () => {
    expect(buildPlayersByMonth([])).toEqual([]);
  });

  it('uses history so mid-series player_count edits change later months', () => {
    expect(
      buildPlayersByMonth(
        [
          {
            created_at: '2026-01-10T12:00:00.000Z',
            player_count: 20,
            player_count_history: [
              { at: '2026-01-10T12:00:00.000Z', count: 17 },
              { at: '2026-08-05T10:00:00.000Z', count: 20 },
            ],
          },
        ],
        { now: new Date(2026, 7, 25), maxMonths: 12 },
      ).filter((p) => p.monthKey === '2026-07' || p.monthKey === '2026-08'),
    ).toEqual([
      { monthKey: '2026-07', value: 17 },
      { monthKey: '2026-08', value: 20 },
    ]);
  });

  it('sums multiple teams with independent history', () => {
    const series = buildPlayersByMonth(
      [
        {
          created_at: '2026-01-01T00:00:00.000Z',
          player_count: 10,
          player_count_history: [
            { at: '2026-01-01T00:00:00.000Z', count: 10 },
            { at: '2026-03-01T00:00:00.000Z', count: 12 },
          ],
        },
        {
          created_at: '2026-02-01T00:00:00.000Z',
          player_count: 5,
          player_count_history: [{ at: '2026-02-01T00:00:00.000Z', count: 5 }],
        },
      ],
      { now: new Date(2026, 2, 15), maxMonths: 12 },
    );
    expect(series).toEqual([
      { monthKey: '2026-01', value: 10 },
      { monthKey: '2026-02', value: 15 },
      { monthKey: '2026-03', value: 17 },
    ]);
  });

  it('falls back to created_at + player_count when history missing', () => {
    expect(
      buildPlayersByMonth([{ created_at: '2026-01-10T12:00:00.000Z', player_count: 17 }], {
        now: new Date(2026, 2, 15),
        maxMonths: 12,
      }),
    ).toEqual([
      { monthKey: '2026-01', value: 17 },
      { monthKey: '2026-02', value: 17 },
      { monthKey: '2026-03', value: 17 },
    ]);
  });

  it('caps to maxMonths ending at now', () => {
    const series = buildPlayersByMonth(
      [
        {
          created_at: '2024-01-01T12:00:00.000Z',
          player_count: 15,
          player_count_history: [
            { at: '2024-01-01T12:00:00.000Z', count: 10 },
            { at: '2026-06-01T12:00:00.000Z', count: 15 },
          ],
        },
      ],
      { now: new Date(2026, 5, 20), maxMonths: 3 },
    );
    expect(series.map((p) => p.monthKey)).toEqual(['2026-04', '2026-05', '2026-06']);
    expect(series[0].value).toBe(10);
    expect(series[2].value).toBe(15);
  });
});

describe('formatPlayersMonthLabel', () => {
  it('formats month short name', () => {
    const label = formatPlayersMonthLabel('2026-01', 'en-US');
    expect(label.toLowerCase()).toContain('jan');
  });
});

import { getDaysUntilTrainingAfterBreak } from '../teams';

function dateOnlyOffsetFromToday(dayOffset: number): string {
  const day = new Date();
  day.setHours(0, 0, 0, 0);
  day.setDate(day.getDate() + dayOffset);
  const y = day.getFullYear();
  const m = String(day.getMonth() + 1).padStart(2, '0');
  const d = String(day.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

describe('getDaysUntilTrainingAfterBreak', () => {
  it('returns null when there are no season breaks', () => {
    expect(getDaysUntilTrainingAfterBreak({ season_breaks: [] })).toBeNull();
    expect(getDaysUntilTrainingAfterBreak({})).toBeNull();
  });

  it('returns null for upcoming or past breaks (not ongoing)', () => {
    expect(
      getDaysUntilTrainingAfterBreak({
        season_breaks: [
          {
            name: 'Future',
            startDate: dateOnlyOffsetFromToday(10),
            endDate: dateOnlyOffsetFromToday(20),
          },
          {
            name: 'Past',
            startDate: dateOnlyOffsetFromToday(-20),
            endDate: dateOnlyOffsetFromToday(-5),
          },
        ],
      }),
    ).toBeNull();
  });

  it('returns days until endDate for an ongoing break (including today = 0)', () => {
    expect(
      getDaysUntilTrainingAfterBreak({
        season_breaks: [
          {
            name: 'Now',
            startDate: dateOnlyOffsetFromToday(-2),
            endDate: dateOnlyOffsetFromToday(0),
          },
        ],
      }),
    ).toBe(0);

    expect(
      getDaysUntilTrainingAfterBreak({
        season_breaks: [
          {
            name: 'Soon',
            startDate: dateOnlyOffsetFromToday(-1),
            endDate: dateOnlyOffsetFromToday(3),
          },
        ],
      }),
    ).toBe(3);

    expect(
      getDaysUntilTrainingAfterBreak({
        season_breaks: [
          {
            name: 'Later',
            startDate: dateOnlyOffsetFromToday(-1),
            endDate: dateOnlyOffsetFromToday(10),
          },
        ],
      }),
    ).toBe(10);
  });

  it('uses the nearest endDate when multiple breaks are ongoing', () => {
    expect(
      getDaysUntilTrainingAfterBreak({
        season_breaks: [
          {
            name: 'Long',
            startDate: dateOnlyOffsetFromToday(-5),
            endDate: dateOnlyOffsetFromToday(14),
          },
          {
            name: 'Short',
            startDate: dateOnlyOffsetFromToday(-1),
            endDate: dateOnlyOffsetFromToday(2),
          },
        ],
      }),
    ).toBe(2);
  });

  it('ignores status-only break (no calendar endDate on season_breaks)', () => {
    // Helper only inspects season_breaks; status is not a parameter.
    expect(getDaysUntilTrainingAfterBreak({ season_breaks: undefined })).toBeNull();
  });
});

import {
  compareMatchesByField,
  compareMatchesTwoLevel,
  getMatchSortValue,
  isMatchStringSortField,
} from '../matchListSort';

const base = {
  home_team: 'Team Alpha',
  away_team: 'Team Beta',
  location: 'Stadium A',
  competition_name: 'League Cup',
  start_time: '2026-08-10T15:00:00.000Z',
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-10T00:00:00.000Z',
};

describe('isMatchStringSortField', () => {
  it('treats home_team, away_team, location, competition_name as string fields', () => {
    expect(isMatchStringSortField('home_team')).toBe(true);
    expect(isMatchStringSortField('away_team')).toBe(true);
    expect(isMatchStringSortField('location')).toBe(true);
    expect(isMatchStringSortField('competition_name')).toBe(true);
    expect(isMatchStringSortField('start_time')).toBe(false);
    expect(isMatchStringSortField('updated_at')).toBe(false);
  });
});

describe('getMatchSortValue', () => {
  it('lowercases string fields', () => {
    expect(getMatchSortValue({ ...base, home_team: 'Team Alpha' }, 'home_team')).toBe('team alpha');
    expect(getMatchSortValue({ ...base, away_team: 'Team Beta' }, 'away_team')).toBe('team beta');
    expect(getMatchSortValue({ ...base, location: null }, 'location')).toBe('');
    expect(getMatchSortValue({ ...base, competition_name: null }, 'competition_name')).toBe('');
  });

  it('returns Date for date fields', () => {
    const val = getMatchSortValue(base, 'start_time');
    expect(val).toBeInstanceOf(Date);
    expect((val as Date).toISOString()).toBe('2026-08-10T15:00:00.000Z');
  });

  it('returns null for null date fields', () => {
    expect(getMatchSortValue({ ...base, start_time: '' }, 'start_time')).toBeNull();
  });
});

describe('compareMatchesByField', () => {
  it('sorts home_team ascending and descending', () => {
    const a = { ...base, home_team: 'Alpha' };
    const b = { ...base, home_team: 'Beta' };
    expect(compareMatchesByField(a, b, 'home_team', 'asc')).toBeLessThan(0);
    expect(compareMatchesByField(a, b, 'home_team', 'desc')).toBeGreaterThan(0);
  });

  it('places null location after non-null when ascending', () => {
    const withLoc = { ...base, location: 'Stadium A' };
    const noLoc = { ...base, location: null };
    // null lowercases to '' which comes before 'stadium a' in asc
    expect(compareMatchesByField(noLoc, withLoc, 'location', 'asc')).toBeLessThan(0);
  });

  it('sorts start_time date ascending', () => {
    const earlier = { ...base, start_time: '2026-07-01T00:00:00.000Z' };
    const later = { ...base, start_time: '2026-08-01T00:00:00.000Z' };
    expect(compareMatchesByField(earlier, later, 'start_time', 'asc')).toBeLessThan(0);
    expect(compareMatchesByField(earlier, later, 'start_time', 'desc')).toBeGreaterThan(0);
  });
});

describe('compareMatchesTwoLevel', () => {
  it('uses primary only when secondary is empty', () => {
    const a = { ...base, home_team: 'Alpha' };
    const b = { ...base, home_team: 'Beta' };
    expect(compareMatchesTwoLevel(a, b, 'home_team', '', 'asc')).toBeLessThan(0);
  });

  it('breaks ties with secondary field', () => {
    const a = { ...base, home_team: 'Same', away_team: 'Alpha' };
    const b = { ...base, home_team: 'Same', away_team: 'Zulu' };
    expect(compareMatchesTwoLevel(a, b, 'home_team', 'away_team', 'asc')).toBeLessThan(0);
    expect(compareMatchesTwoLevel(a, b, 'home_team', 'away_team', 'desc')).toBeGreaterThan(0);
  });

  it('returns 0 when primary and secondary are equal', () => {
    const a = { ...base, home_team: 'Same', away_team: 'Same' };
    const b = { ...base, home_team: 'Same', away_team: 'Same' };
    expect(compareMatchesTwoLevel(a, b, 'home_team', 'away_team', 'asc')).toBe(0);
  });

  it('with date primary + secondary, reorders same-day items by secondary', () => {
    const earlyInDay = {
      ...base,
      home_team: 'Zulu FC',
      start_time: new Date(2026, 6, 10, 8, 0, 0).toISOString(),
    };
    const lateInDay = {
      ...base,
      home_team: 'Alpha FC',
      start_time: new Date(2026, 6, 10, 18, 0, 0).toISOString(),
    };
    // Same calendar day + home_team asc → Alpha FC before Zulu FC
    expect(
      compareMatchesTwoLevel(earlyInDay, lateInDay, 'start_time', 'home_team', 'asc'),
    ).toBeGreaterThan(0);
    expect(
      compareMatchesTwoLevel(lateInDay, earlyInDay, 'start_time', 'home_team', 'asc'),
    ).toBeLessThan(0);
  });

  it('with date primary + secondary, different days still follow primary day order', () => {
    const day1 = {
      ...base,
      home_team: 'Alpha FC',
      start_time: new Date(2026, 6, 9, 23, 0, 0).toISOString(),
    };
    const day2 = {
      ...base,
      home_team: 'Zulu FC',
      start_time: new Date(2026, 6, 10, 1, 0, 0).toISOString(),
    };
    expect(compareMatchesTwoLevel(day1, day2, 'start_time', 'home_team', 'desc')).toBeGreaterThan(
      0,
    );
  });
});

import { compareMatchesByField, getMatchSortValue, isMatchStringSortField } from '../matchListSort';

const base = {
  home_team: 'Team Alpha',
  away_team: 'Team Beta',
  location: 'Stadium A',
  competition_name: 'League Cup',
  team_id: '12',
  start_time: '2026-08-10T15:00:00.000Z',
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-10T00:00:00.000Z',
};

describe('isMatchStringSortField', () => {
  it('treats home_team, away_team, location, competition_name, team_id as string fields', () => {
    expect(isMatchStringSortField('home_team')).toBe(true);
    expect(isMatchStringSortField('away_team')).toBe(true);
    expect(isMatchStringSortField('location')).toBe(true);
    expect(isMatchStringSortField('competition_name')).toBe(true);
    expect(isMatchStringSortField('team_id')).toBe(true);
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
    expect(getMatchSortValue({ ...base, team_id: '12' }, 'team_id', { '12': 'U16 Blue' })).toBe(
      'u16 blue',
    );
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

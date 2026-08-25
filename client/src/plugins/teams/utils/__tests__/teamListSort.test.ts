import {
  compareTeamsByField,
  getTeamSortValue,
  isTeamStringSortField,
  isTeamDateSortField,
} from '../teamListSort';

const base = {
  name: 'Alpha FC',
  age_group: 'U14' as string | null,
  gender: 'boys' as const,
  status: 'active' as const,
  player_count: 15,
  player_count_history: [{ at: '2026-06-01T10:00:00.000Z', count: 15 }],
  updated_at: '2026-07-10T10:00:00.000Z',
  created_at: '2026-06-01T10:00:00.000Z',
};

describe('isTeamStringSortField', () => {
  it('classifies name, age_group, gender, status as string fields', () => {
    expect(isTeamStringSortField('name')).toBe(true);
    expect(isTeamStringSortField('age_group')).toBe(true);
    expect(isTeamStringSortField('gender')).toBe(true);
    expect(isTeamStringSortField('status')).toBe(true);
    expect(isTeamStringSortField('player_count')).toBe(false);
    expect(isTeamStringSortField('updated_at')).toBe(false);
    expect(isTeamStringSortField('created_at')).toBe(false);
  });
});

describe('isTeamDateSortField', () => {
  it('classifies updated_at and created_at as date fields', () => {
    expect(isTeamDateSortField('updated_at')).toBe(true);
    expect(isTeamDateSortField('created_at')).toBe(true);
    expect(isTeamDateSortField('name')).toBe(false);
    expect(isTeamDateSortField('player_count')).toBe(false);
  });
});

describe('getTeamSortValue', () => {
  it('lowercases name and age_group', () => {
    expect(getTeamSortValue({ ...base, name: 'ZETA FC' }, 'name')).toBe('zeta fc');
    expect(getTeamSortValue({ ...base, age_group: 'U16' }, 'age_group')).toBe('u16');
  });

  it('returns empty string for null age_group', () => {
    expect(getTeamSortValue({ ...base, age_group: null }, 'age_group')).toBe('');
  });

  it('returns player_count as number', () => {
    expect(getTeamSortValue({ ...base, player_count: 20 }, 'player_count')).toBe(20);
  });

  it('returns date strings as-is', () => {
    expect(getTeamSortValue(base, 'updated_at')).toBe('2026-07-10T10:00:00.000Z');
    expect(getTeamSortValue(base, 'created_at')).toBe('2026-06-01T10:00:00.000Z');
  });
});

describe('compareTeamsByField', () => {
  it('sorts names alphabetically', () => {
    const a = { ...base, name: 'Alpha FC' };
    const b = { ...base, name: 'Zeta FC' };
    expect(compareTeamsByField(a, b, 'name', 'asc')).toBeLessThan(0);
    expect(compareTeamsByField(a, b, 'name', 'desc')).toBeGreaterThan(0);
  });

  it('sorts player_count numerically', () => {
    const few = { ...base, player_count: 5 };
    const many = { ...base, player_count: 20 };
    expect(compareTeamsByField(few, many, 'player_count', 'asc')).toBeLessThan(0);
    expect(compareTeamsByField(few, many, 'player_count', 'desc')).toBeGreaterThan(0);
  });

  it('sorts by updated_at date', () => {
    const earlier = { ...base, updated_at: '2026-07-01T00:00:00.000Z' };
    const later = { ...base, updated_at: '2026-07-20T00:00:00.000Z' };
    expect(compareTeamsByField(earlier, later, 'updated_at', 'asc')).toBeLessThan(0);
    expect(compareTeamsByField(earlier, later, 'updated_at', 'desc')).toBeGreaterThan(0);
  });

  it('places null age_group after non-null when ascending', () => {
    const withGroup = { ...base, age_group: 'U12' };
    const withoutGroup = { ...base, age_group: null };
    expect(compareTeamsByField(withoutGroup, withGroup, 'age_group', 'asc')).toBeGreaterThan(0);
    expect(compareTeamsByField(withoutGroup, withGroup, 'age_group', 'desc')).toBeLessThan(0);
  });
});

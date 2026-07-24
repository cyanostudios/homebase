import {
  isTeamColumnCount,
  parseStoredTeamColumnCount,
  resolveTeamColumnCount,
} from '../teamColumnCount';

describe('resolveTeamColumnCount', () => {
  it('uses columnCount when valid', () => {
    expect(resolveTeamColumnCount({ columnCount: 1 })).toBe(1);
    expect(resolveTeamColumnCount({ columnCount: 2 })).toBe(2);
    expect(resolveTeamColumnCount({ columnCount: '3' })).toBe(3);
  });

  it('defaults to 3 when columnCount is absent', () => {
    expect(resolveTeamColumnCount(null)).toBe(3);
    expect(resolveTeamColumnCount({})).toBe(3);
    expect(resolveTeamColumnCount(undefined)).toBe(3);
  });

  it('ignores invalid columnCount and falls back to 3', () => {
    expect(resolveTeamColumnCount({ columnCount: 0 })).toBe(3);
    expect(resolveTeamColumnCount({ columnCount: 4 })).toBe(3);
    expect(resolveTeamColumnCount({ columnCount: 'grid' })).toBe(3);
  });
});

describe('isTeamColumnCount', () => {
  it('accepts only 1, 2, 3', () => {
    expect(isTeamColumnCount(1)).toBe(true);
    expect(isTeamColumnCount(2)).toBe(true);
    expect(isTeamColumnCount(3)).toBe(true);
    expect(isTeamColumnCount(0)).toBe(false);
    expect(isTeamColumnCount(4)).toBe(false);
    expect(isTeamColumnCount('2')).toBe(false);
  });
});

describe('parseStoredTeamColumnCount', () => {
  it('parses valid stored strings', () => {
    expect(parseStoredTeamColumnCount('1')).toBe(1);
    expect(parseStoredTeamColumnCount('2')).toBe(2);
    expect(parseStoredTeamColumnCount('3')).toBe(3);
  });

  it('returns null for invalid or empty input', () => {
    expect(parseStoredTeamColumnCount(null)).toBe(null);
    expect(parseStoredTeamColumnCount('')).toBe(null);
    expect(parseStoredTeamColumnCount('grid')).toBe(null);
    expect(parseStoredTeamColumnCount('4')).toBe(null);
  });
});

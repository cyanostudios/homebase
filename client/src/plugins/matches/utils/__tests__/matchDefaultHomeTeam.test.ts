import {
  matchHomeTeamEqualsDefault,
  normalizeMatchHomeTeamName,
  resolveMatchDefaultHomeTeam,
} from '../matchDefaultHomeTeam';

describe('normalizeMatchHomeTeamName', () => {
  it('trims and lowercases', () => {
    expect(normalizeMatchHomeTeamName('  AIK P16  ')).toBe('aik p16');
  });

  it('returns empty for non-strings', () => {
    expect(normalizeMatchHomeTeamName(null)).toBe('');
    expect(normalizeMatchHomeTeamName(12)).toBe('');
  });
});

describe('resolveMatchDefaultHomeTeam', () => {
  it('returns trimmed string from settings', () => {
    expect(resolveMatchDefaultHomeTeam({ defaultHomeTeam: '  Home FC  ' })).toBe('Home FC');
  });

  it('returns empty when missing or invalid', () => {
    expect(resolveMatchDefaultHomeTeam(null)).toBe('');
    expect(resolveMatchDefaultHomeTeam({})).toBe('');
    expect(resolveMatchDefaultHomeTeam({ defaultHomeTeam: '   ' })).toBe('');
    expect(resolveMatchDefaultHomeTeam({ defaultHomeTeam: 1 })).toBe('');
  });
});

describe('matchHomeTeamEqualsDefault', () => {
  it('matches case-insensitively with trim', () => {
    expect(matchHomeTeamEqualsDefault('  aik p16 ', 'AIK P16')).toBe(true);
  });

  it('rejects non-equal or empty default', () => {
    expect(matchHomeTeamEqualsDefault('AIK P16', 'Other')).toBe(false);
    expect(matchHomeTeamEqualsDefault('AIK P16', '')).toBe(false);
    expect(matchHomeTeamEqualsDefault('AIK P16', '   ')).toBe(false);
  });
});

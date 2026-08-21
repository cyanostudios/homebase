import { formatTeamLabel } from '../formatTeamLabel';

describe('formatTeamLabel', () => {
  it('returns age group when present', () => {
    expect(formatTeamLabel({ name: 'Flickor 2016', age_group: 'F10' })).toBe('F10');
  });

  it('returns only name when age group is missing', () => {
    expect(formatTeamLabel({ name: 'Flickor 2017', age_group: null })).toBe('Flickor 2017');
    expect(formatTeamLabel({ name: 'Flickor 2017', age_group: '  ' })).toBe('Flickor 2017');
  });

  it('returns only age group when name is missing', () => {
    expect(formatTeamLabel({ name: '', age_group: 'F9' })).toBe('F9');
    expect(formatTeamLabel({ name: null, age_group: 'F9' })).toBe('F9');
  });

  it('returns empty string when both missing', () => {
    expect(formatTeamLabel({ name: '', age_group: null })).toBe('');
  });
});

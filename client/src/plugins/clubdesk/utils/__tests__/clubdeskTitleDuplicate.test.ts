import { hasDuplicateClubdeskTitle } from '../clubdeskTitleDuplicate';

const rows = [
  { id: '1', title: 'Brew' },
  { id: '2', title: 'Clean Machine' },
];

describe('hasDuplicateClubdeskTitle', () => {
  it('detects case-insensitive duplicates', () => {
    expect(hasDuplicateClubdeskTitle(rows, 'brew')).toBe(true);
    expect(hasDuplicateClubdeskTitle(rows, '  BREW  ')).toBe(true);
  });

  it('ignores the excluded clubdesk id (update path)', () => {
    expect(hasDuplicateClubdeskTitle(rows, 'Brew', '1')).toBe(false);
  });

  it('still flags another row when excludeId is set', () => {
    expect(hasDuplicateClubdeskTitle(rows, 'Clean Machine', '1')).toBe(true);
  });

  it('returns false for empty title or no match', () => {
    expect(hasDuplicateClubdeskTitle(rows, '   ')).toBe(false);
    expect(hasDuplicateClubdeskTitle(rows, 'New Guide')).toBe(false);
  });
});

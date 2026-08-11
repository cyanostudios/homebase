import {
  instructionMatchesListFilters,
  toggleInstructionListFilter,
} from '../instructionListFilter';

describe('instructionMatchesListFilters', () => {
  it('allows all when selection is empty', () => {
    expect(instructionMatchesListFilters({ publicationStatus: 'draft' }, [])).toBe(true);
    expect(instructionMatchesListFilters({ publicationStatus: 'published' }, [])).toBe(true);
  });

  it('matches draft and published', () => {
    expect(instructionMatchesListFilters({ publicationStatus: 'draft' }, ['draft'])).toBe(true);
    expect(instructionMatchesListFilters({ publicationStatus: 'published' }, ['draft'])).toBe(
      false,
    );
    expect(instructionMatchesListFilters({ publicationStatus: 'published' }, ['published'])).toBe(
      true,
    );
  });
});

describe('toggleInstructionListFilter', () => {
  it('replaces within exclusive status group', () => {
    expect(toggleInstructionListFilter([], 'draft')).toEqual(['draft']);
    expect(toggleInstructionListFilter(['draft'], 'published')).toEqual(['published']);
    expect(toggleInstructionListFilter(['published'], 'published')).toEqual([]);
  });
});

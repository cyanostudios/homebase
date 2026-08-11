import {
  guideMatchesListFilters,
  guideMatchesSingleFilter,
  toggleGuideListFilter,
} from '../guideListFilter';

describe('guideListFilter', () => {
  const draft = { lifecycleStatus: 'draft' as const, hasReadyAudio: false };
  const activeReady = { lifecycleStatus: 'active' as const, hasReadyAudio: true };

  it('matches single filters', () => {
    expect(guideMatchesSingleFilter(draft, 'draft')).toBe(true);
    expect(guideMatchesSingleFilter(draft, 'active')).toBe(false);
    expect(guideMatchesSingleFilter(activeReady, 'audioReady')).toBe(true);
  });

  it('ANDs selected filters; empty selection matches all', () => {
    expect(guideMatchesListFilters(activeReady, [])).toBe(true);
    expect(guideMatchesListFilters(activeReady, ['active', 'audioReady'])).toBe(true);
    expect(guideMatchesListFilters(draft, ['active', 'audioReady'])).toBe(false);
  });

  it('toggles draft/active exclusively and audioReady independently', () => {
    expect(toggleGuideListFilter([], 'draft')).toEqual(['draft']);
    expect(toggleGuideListFilter(['draft'], 'active')).toEqual(['active']);
    expect(toggleGuideListFilter(['active', 'audioReady'], 'draft')).toEqual([
      'audioReady',
      'draft',
    ]);
    expect(toggleGuideListFilter(['draft'], 'audioReady')).toEqual(['draft', 'audioReady']);
  });
});

import {
  getInitialGuideListViewMode,
  GUIDES_LIST_VIEW_MODE_STORAGE_KEY,
  isGuideListViewMode,
  resolveGuideListViewMode,
} from '../guideListViewMode';

describe('resolveGuideListViewMode', () => {
  it('uses listViewMode when valid and defaults to cards', () => {
    expect(resolveGuideListViewMode({ listViewMode: 'table' })).toBe('table');
    expect(resolveGuideListViewMode({})).toBe('cards');
  });
});

describe('guides session listViewMode', () => {
  it('uses guides:listViewMode storage key and defaults initial to cards', () => {
    expect(GUIDES_LIST_VIEW_MODE_STORAGE_KEY).toBe('guides:listViewMode');
    expect(isGuideListViewMode('table')).toBe(true);
    expect(isGuideListViewMode('grid')).toBe(false);
    expect(getInitialGuideListViewMode()).toBe('cards');
  });
});

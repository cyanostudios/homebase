import {
  getInitialFileListViewMode,
  isFileListViewMode,
  resolveFileListViewMode,
} from '../fileListViewMode';

describe('resolveFileListViewMode', () => {
  it('uses listViewMode when valid', () => {
    expect(resolveFileListViewMode({ listViewMode: 'table' })).toBe('table');
    expect(resolveFileListViewMode({ listViewMode: 'cards' })).toBe('cards');
  });

  it('defaults to cards', () => {
    expect(resolveFileListViewMode(null)).toBe('cards');
    expect(resolveFileListViewMode({})).toBe('cards');
    expect(resolveFileListViewMode({ listViewMode: 'grid' })).toBe('cards');
  });
});

describe('isFileListViewMode', () => {
  it('accepts only cards and table', () => {
    expect(isFileListViewMode('cards')).toBe(true);
    expect(isFileListViewMode('table')).toBe(true);
    expect(isFileListViewMode('grid')).toBe(false);
  });
});

describe('getInitialFileListViewMode', () => {
  it('defaults to cards when session is empty', () => {
    expect(getInitialFileListViewMode()).toBe('cards');
  });
});

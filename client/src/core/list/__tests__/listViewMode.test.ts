import {
  getInitialListViewMode,
  persistListViewModeSession,
  resolveListViewMode,
  type ListViewMode,
} from '../listViewMode';

describe('listViewMode', () => {
  it('resolves cards/table and defaults', () => {
    expect(resolveListViewMode({ listViewMode: 'table' })).toBe('table');
    expect(resolveListViewMode({ listViewMode: 'cards' })).toBe('cards');
    expect(resolveListViewMode({})).toBe('cards');
    expect(resolveListViewMode({ listViewMode: 'grid' })).toBe('cards');
  });

  it('defaults initial to cards when storage empty or unavailable', () => {
    expect(getInitialListViewMode('test:listViewMode')).toBe('cards');
  });

  it('persistListViewModeSession is a no-op without window (safe in node)', () => {
    expect(() => persistListViewModeSession('test:listViewMode', 'table')).not.toThrow();
  });
});

export type { ListViewMode };

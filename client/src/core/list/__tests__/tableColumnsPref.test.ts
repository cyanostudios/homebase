import { createTableColumnsHelpers, type TableColumnsPref } from '@/core/list/tableColumnsPref';

describe('createTableColumnsHelpers', () => {
  const helpers = createTableColumnsHelpers({
    columnIds: ['title', 'status', 'createdAt'] as const,
    requiredColumnId: 'title',
    defaultHidden: ['createdAt'],
  });

  it('defaults visible to non-hidden columns', () => {
    expect(helpers.resolveVisible(null)).toEqual(['title', 'status']);
  });

  it('strips unknown ids and keeps required visible', () => {
    const pref = helpers.normalize({
      order: ['status', 'bogus', 'title'],
      hidden: ['title', 'status', 'bogus'],
    });
    expect(pref.order).toEqual(['status', 'title', 'createdAt']);
    expect(pref.hidden).toEqual(['status']);
    expect(helpers.resolveVisible({ tableColumns: pref })).toContain('title');
  });

  it('reorders and refuses to hide required column', () => {
    const order = helpers.reorder([...helpers.DEFAULT.order], 'status', 'title');
    expect(order[0]).toBe('status');
    const pref = helpers.setHidden(helpers.DEFAULT, 'title', true);
    expect(pref.hidden).not.toContain('title');
    expect(helpers.equal(pref, helpers.DEFAULT)).toBe(true);
  });

  it('detects equality', () => {
    const a: TableColumnsPref<'title' | 'status' | 'createdAt'> = {
      order: ['title', 'status', 'createdAt'],
      hidden: ['createdAt'],
    };
    expect(helpers.equal(a, helpers.DEFAULT)).toBe(true);
  });
});

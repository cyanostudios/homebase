import { nextListTableSort } from '../listViewMode';

describe('nextListTableSort', () => {
  const isAscDefault = (field: 'name' | 'updatedAt') => field === 'name';

  it('toggles order when the same field is clicked', () => {
    expect(nextListTableSort('name', 'asc', 'name', isAscDefault)).toEqual({
      field: 'name',
      order: 'desc',
    });
    expect(nextListTableSort('name', 'desc', 'name', isAscDefault)).toEqual({
      field: 'name',
      order: 'asc',
    });
  });

  it('switches field using the plugin default order', () => {
    expect(nextListTableSort('name', 'asc', 'updatedAt', isAscDefault)).toEqual({
      field: 'updatedAt',
      order: 'desc',
    });
    expect(nextListTableSort('updatedAt', 'desc', 'name', isAscDefault)).toEqual({
      field: 'name',
      order: 'asc',
    });
  });
});

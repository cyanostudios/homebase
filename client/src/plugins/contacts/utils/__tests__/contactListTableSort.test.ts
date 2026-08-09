import { nextContactTableSort } from '../contactListSort';

describe('nextContactTableSort', () => {
  it('toggles order when the same field is clicked', () => {
    expect(nextContactTableSort('name', 'asc', 'name')).toEqual({ field: 'name', order: 'desc' });
    expect(nextContactTableSort('name', 'desc', 'name')).toEqual({ field: 'name', order: 'asc' });
  });

  it('switches field and applies default order for the new field', () => {
    expect(nextContactTableSort('name', 'asc', 'email')).toEqual({ field: 'email', order: 'asc' });
    expect(nextContactTableSort('name', 'asc', 'updatedAt')).toEqual({
      field: 'updatedAt',
      order: 'desc',
    });
  });
});

import {
  DEFAULT_CONTACT_TABLE_COLUMNS,
  contactTableColumnsEqual,
  normalizeContactTableColumns,
  reorderContactTableColumns,
  resolveVisibleContactTableColumns,
  setContactTableColumnHidden,
  type ContactTableColumnId,
} from '../contactTableColumns';

describe('normalizeContactTableColumns', () => {
  it('returns defaults for missing or invalid input', () => {
    expect(normalizeContactTableColumns(null)).toEqual(DEFAULT_CONTACT_TABLE_COLUMNS);
    expect(normalizeContactTableColumns(undefined)).toEqual(DEFAULT_CONTACT_TABLE_COLUMNS);
    expect(normalizeContactTableColumns('x')).toEqual(DEFAULT_CONTACT_TABLE_COLUMNS);
    expect(normalizeContactTableColumns([])).toEqual(DEFAULT_CONTACT_TABLE_COLUMNS);
  });

  it('strips unknown ids, dedupes, and appends missing known ids', () => {
    const result = normalizeContactTableColumns({
      order: ['email', 'name', 'name', 'bogus', 'type'],
      hidden: ['email', 'bogus', 'name'],
    });
    expect(result.order[0]).toBe('email');
    expect(result.order).toContain('name');
    expect(result.order).toContain('tags');
    expect(result.order.filter((id) => id === 'name')).toHaveLength(1);
    expect(result.hidden).toEqual(['email']);
  });

  it('inserts name when missing from order', () => {
    const result = normalizeContactTableColumns({
      order: ['type', 'tags'],
      hidden: [],
    });
    expect(result.order[0]).toBe('name');
  });

  it('falls back to defaults when visible set would be empty', () => {
    const allHidden = DEFAULT_CONTACT_TABLE_COLUMNS.order.filter((id) => id !== 'name');
    // Even if client sends every id in hidden including name, name is stripped —
    // so visible cannot be empty unless order is empty of known ids (handled by defaults).
    const result = normalizeContactTableColumns({
      order: ['name'],
      hidden: ['name', ...allHidden],
    });
    expect(result.hidden).not.toContain('name');
    expect(resolveVisibleContactTableColumns({ tableColumns: result })).toContain('name');
  });
});

describe('resolveVisibleContactTableColumns', () => {
  it('defaults to name type tags assignable time', () => {
    expect(resolveVisibleContactTableColumns(null)).toEqual([
      'name',
      'type',
      'tags',
      'assignable',
      'time',
    ]);
  });

  it('respects custom order and hidden', () => {
    expect(
      resolveVisibleContactTableColumns({
        tableColumns: {
          order: [
            'name',
            'email',
            'type',
            'tags',
            'assignable',
            'time',
            'phone',
            'createdAt',
            'updatedAt',
          ],
          hidden: ['type', 'tags', 'assignable', 'time', 'phone', 'createdAt', 'updatedAt'],
        },
      }),
    ).toEqual(['name', 'email']);
  });
});

describe('reorderContactTableColumns / setContactTableColumnHidden', () => {
  it('reorders and refuses to hide name', () => {
    const order = reorderContactTableColumns(
      [...DEFAULT_CONTACT_TABLE_COLUMNS.order],
      'tags',
      'name',
    );
    expect(order[0]).toBe('tags');
    expect(order[1]).toBe('name');

    const pref = setContactTableColumnHidden(DEFAULT_CONTACT_TABLE_COLUMNS, 'name', true);
    expect(pref.hidden).not.toContain('name');
    expect(contactTableColumnsEqual(pref, DEFAULT_CONTACT_TABLE_COLUMNS)).toBe(true);

    const withEmail = setContactTableColumnHidden(DEFAULT_CONTACT_TABLE_COLUMNS, 'email', false);
    expect(withEmail.hidden).not.toContain('email');
  });
});

describe('isContactTableColumnId typing helper via normalize', () => {
  it('accepts all canonical ids', () => {
    const ids: ContactTableColumnId[] = [
      'name',
      'type',
      'tags',
      'assignable',
      'time',
      'email',
      'phone',
      'createdAt',
      'updatedAt',
    ];
    const result = normalizeContactTableColumns({ order: ids, hidden: [] });
    expect(result.order).toEqual(ids);
    expect(result.hidden).toEqual([]);
  });
});

import {
  DEFAULT_INVOICE_TABLE_COLUMNS,
  invoiceTableColumnsEqual,
  normalizeInvoiceTableColumns,
  reorderInvoiceTableColumns,
  resolveVisibleInvoiceTableColumns,
  setInvoiceTableColumnHidden,
  type InvoiceTableColumnId,
} from '../invoiceTableColumns';

describe('normalizeInvoiceTableColumns', () => {
  it('returns defaults for missing or invalid input', () => {
    expect(normalizeInvoiceTableColumns(null)).toEqual(DEFAULT_INVOICE_TABLE_COLUMNS);
    expect(normalizeInvoiceTableColumns(undefined)).toEqual(DEFAULT_INVOICE_TABLE_COLUMNS);
    expect(normalizeInvoiceTableColumns('x')).toEqual(DEFAULT_INVOICE_TABLE_COLUMNS);
    expect(normalizeInvoiceTableColumns([])).toEqual(DEFAULT_INVOICE_TABLE_COLUMNS);
  });

  it('strips unknown ids, dedupes, and appends missing known ids', () => {
    const result = normalizeInvoiceTableColumns({
      order: ['status', 'invoiceNumber', 'invoiceNumber', 'bogus', 'total'],
      hidden: ['status', 'bogus', 'invoiceNumber'],
    });
    expect(result.order[0]).toBe('status');
    expect(result.order).toContain('invoiceNumber');
    expect(result.order).toContain('dueDate');
    expect(result.order.filter((id) => id === 'invoiceNumber')).toHaveLength(1);
    expect(result.hidden).toEqual(['status']);
  });

  it('inserts invoiceNumber when missing from order', () => {
    const result = normalizeInvoiceTableColumns({
      order: ['status', 'total'],
      hidden: [],
    });
    expect(result.order[0]).toBe('invoiceNumber');
  });

  it('refuses to leave invoiceNumber hidden', () => {
    const allHidden = DEFAULT_INVOICE_TABLE_COLUMNS.order.filter((id) => id !== 'invoiceNumber');
    const result = normalizeInvoiceTableColumns({
      order: ['invoiceNumber'],
      hidden: ['invoiceNumber', ...allHidden],
    });
    expect(result.hidden).not.toContain('invoiceNumber');
    expect(resolveVisibleInvoiceTableColumns({ tableColumns: result })).toContain('invoiceNumber');
  });
});

describe('resolveVisibleInvoiceTableColumns', () => {
  it('defaults to five visible columns', () => {
    expect(resolveVisibleInvoiceTableColumns(null)).toEqual([
      'invoiceNumber',
      'contactName',
      'status',
      'total',
      'dueDate',
    ]);
  });

  it('respects custom order and hidden', () => {
    expect(
      resolveVisibleInvoiceTableColumns({
        tableColumns: {
          order: [
            'invoiceNumber',
            'total',
            'contactName',
            'status',
            'dueDate',
            'createdAt',
            'updatedAt',
          ],
          hidden: ['contactName', 'status', 'dueDate', 'createdAt', 'updatedAt'],
        },
      }),
    ).toEqual(['invoiceNumber', 'total']);
  });
});

describe('reorderInvoiceTableColumns / setInvoiceTableColumnHidden', () => {
  it('reorders and refuses to hide invoiceNumber', () => {
    const order = reorderInvoiceTableColumns(
      [...DEFAULT_INVOICE_TABLE_COLUMNS.order],
      'status',
      'invoiceNumber',
    );
    expect(order[0]).toBe('status');
    expect(order[1]).toBe('invoiceNumber');

    const pref = setInvoiceTableColumnHidden(DEFAULT_INVOICE_TABLE_COLUMNS, 'invoiceNumber', true);
    expect(pref.hidden).not.toContain('invoiceNumber');
    expect(invoiceTableColumnsEqual(pref, DEFAULT_INVOICE_TABLE_COLUMNS)).toBe(true);

    const withCreated = setInvoiceTableColumnHidden(
      DEFAULT_INVOICE_TABLE_COLUMNS,
      'createdAt',
      false,
    );
    expect(withCreated.hidden).not.toContain('createdAt');
  });
});

describe('isInvoiceTableColumnId typing helper via normalize', () => {
  it('accepts all canonical ids', () => {
    const ids: InvoiceTableColumnId[] = [
      'invoiceNumber',
      'contactName',
      'status',
      'total',
      'dueDate',
      'createdAt',
      'updatedAt',
    ];
    const result = normalizeInvoiceTableColumns({ order: ids, hidden: [] });
    expect(result.order).toEqual(ids);
    expect(result.hidden).toEqual([]);
  });
});

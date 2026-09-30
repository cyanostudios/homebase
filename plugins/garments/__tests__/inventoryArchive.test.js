jest.mock('@homebase/core', () => ({
  Logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  Database: {
    get: jest.fn(),
  },
}));

const GarmentsModel = require('../model');
const { Database } = require('@homebase/core');
const { AppError } = require('../../../server/core/errors/AppError');

function activeItem(overrides = {}) {
  return {
    id: '5',
    articleName: 'Jersey',
    brand: 'Nike',
    description: null,
    material: '',
    purchasePrice: null,
    recommendedPrice: null,
    salePrice: null,
    currency: 'SEK',
    comment: null,
    tags: [],
    variants: [],
    archivedAt: null,
    ...overrides,
  };
}

describe('garments inventory archive', () => {
  let model;
  let dbQuery;
  let pool;

  beforeEach(() => {
    jest.clearAllMocks();
    model = new GarmentsModel();
    dbQuery = jest.fn().mockResolvedValue([]);
    Database.get.mockReturnValue({
      getUserId: () => 1,
      query: dbQuery,
    });
    pool = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      connect: jest.fn(),
    };
  });

  function req() {
    return { tenantPool: pool };
  }

  it('exposes archivedAt from archived_at', () => {
    const item = model.transformInventoryRow({
      id: 5,
      article_name: 'Jersey',
      brand: 'Nike',
      archived_at: '2026-09-29T12:00:00.000Z',
    });
    expect(item.archivedAt).toBe('2026-09-29T12:00:00.000Z');
  });

  it('leaves archivedAt null when the column is empty', () => {
    const item = model.transformInventoryRow({
      id: 5,
      article_name: 'Jersey',
      brand: 'Nike',
      archived_at: null,
    });
    expect(item.archivedAt).toBeNull();
  });

  it('refuses delete of an active article before checking use', async () => {
    jest.spyOn(model, 'getInventoryById').mockResolvedValue(activeItem());

    await expect(model.deleteInventoryItem(req(), 5)).rejects.toMatchObject({
      statusCode: 409,
      code: AppError.CODES.CONFLICT,
      message: 'Cannot delete an inventory item that is not archived',
    });

    expect(pool.query).not.toHaveBeenCalled();
    expect(dbQuery).not.toHaveBeenCalled();
  });

  it('refuses delete and does not unassign when the archived article is in use', async () => {
    jest
      .spyOn(model, 'getInventoryById')
      .mockResolvedValue(activeItem({ archivedAt: '2026-09-29T12:00:00.000Z' }));
    const unassign = jest.spyOn(model, 'unassignInventoryItemFromList');
    pool.query.mockResolvedValueOnce({ rows: [{ in_use: 1 }] });

    await expect(model.deleteInventoryItem(req(), 5)).rejects.toMatchObject({
      statusCode: 409,
      code: AppError.CODES.CONFLICT,
    });

    const sql = String(pool.query.mock.calls[0][0]);
    expect(sql).toMatch(/garment_list_inventory_items/);
    expect(sql).toMatch(/ct_sizes/);
    expect(sql).toMatch(/ct_audiences/);
    expect(sql).toMatch(/checkbox_values/);
    expect(sql).toMatch(/fit_summary_procurement/);
    expect(dbQuery).not.toHaveBeenCalled();
    expect(unassign).not.toHaveBeenCalled();
  });

  it('deletes an unused archived article without force-unassign', async () => {
    jest
      .spyOn(model, 'getInventoryById')
      .mockResolvedValue(activeItem({ archivedAt: '2026-09-29T12:00:00.000Z' }));
    const unassign = jest.spyOn(model, 'unassignInventoryItemFromList');
    pool.query.mockResolvedValueOnce({ rows: [] });
    dbQuery.mockResolvedValueOnce([{ id: 5 }]);

    await expect(model.deleteInventoryItem(req(), 5)).resolves.toEqual({ id: '5' });

    expect(String(dbQuery.mock.calls[0][0])).toMatch(/DELETE FROM garment_inventory_items/);
    expect(unassign).not.toHaveBeenCalled();
  });

  it('sets archived_at once and returns the enriched row', async () => {
    const archived = activeItem({ archivedAt: '2026-09-29T12:00:00.000Z' });
    jest
      .spyOn(model, 'getInventoryById')
      .mockResolvedValueOnce(activeItem())
      .mockResolvedValueOnce(archived);

    await expect(model.archiveInventoryItem(req(), 5)).resolves.toEqual(archived);

    expect(String(dbQuery.mock.calls[0][0])).toMatch(/archived_at = CURRENT_TIMESTAMP/);
  });

  it('does not write again when the article is already archived', async () => {
    const archived = activeItem({ archivedAt: '2026-09-29T12:00:00.000Z' });
    jest.spyOn(model, 'getInventoryById').mockResolvedValue(archived);

    await expect(model.archiveInventoryItem(req(), 5)).resolves.toEqual(archived);
    expect(dbQuery).not.toHaveBeenCalled();
  });

  it('clears archived_at on restore', async () => {
    jest
      .spyOn(model, 'getInventoryById')
      .mockResolvedValueOnce(activeItem({ archivedAt: '2026-09-29T12:00:00.000Z' }))
      .mockResolvedValueOnce(activeItem());

    await expect(model.restoreInventoryItem(req(), 5)).resolves.toMatchObject({
      archivedAt: null,
    });
    expect(String(dbQuery.mock.calls[0][0])).toMatch(/archived_at = NULL/);
  });

  it('returns 409 when restore would clash with an active article', async () => {
    jest
      .spyOn(model, 'getInventoryById')
      .mockResolvedValue(activeItem({ archivedAt: '2026-09-29T12:00:00.000Z' }));
    dbQuery.mockRejectedValueOnce({ code: '23505' });

    await expect(model.restoreInventoryItem(req(), 5)).rejects.toMatchObject({
      statusCode: 409,
      code: AppError.CODES.CONFLICT,
    });
  });

  it('rejects a new assignment of an archived article', async () => {
    jest.spyOn(model, 'getListById').mockResolvedValue({
      id: '3',
      checkboxColumns: [],
    });
    jest
      .spyOn(model, 'getInventoryById')
      .mockResolvedValue(activeItem({ id: '5', archivedAt: '2026-09-29T12:00:00.000Z' }));
    pool.query.mockResolvedValueOnce({ rows: [] });

    await expect(model.assignInventoryItemToList(req(), 3, 5)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('keeps an existing join when the article is archived', async () => {
    const list = { id: '3', checkboxColumns: [], assignedInventoryItemIds: ['5'] };
    jest.spyOn(model, 'getListById').mockResolvedValue(list);
    jest
      .spyOn(model, 'getInventoryById')
      .mockResolvedValue(activeItem({ archivedAt: '2026-09-29T12:00:00.000Z' }));
    pool.query.mockResolvedValueOnce({ rows: [{ id: 9 }] });

    await expect(model.assignInventoryItemToList(req(), 3, 5)).resolves.toEqual(list);
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('does not write archived_at from a product update', async () => {
    jest
      .spyOn(model, 'getInventoryById')
      .mockResolvedValue(activeItem({ archivedAt: '2026-09-29T12:00:00.000Z' }));
    jest.spyOn(model, 'syncInventoryVariants').mockResolvedValue(undefined);

    await model.updateInventoryItem(req(), 5, {
      articleName: 'Jersey',
      archivedAt: null,
      variants: [],
    });

    const sql = dbQuery.mock.calls.map((call) => String(call[0])).join('\n');
    expect(sql).not.toMatch(/archived_at/);
  });

  function scriptedClient(handler) {
    const client = {
      query: jest.fn(async (sql) => handler(String(sql))),
      release: jest.fn(),
    };
    pool.connect.mockResolvedValue(client);
    return client;
  }

  it('copies joins for an archived article without assigning', async () => {
    const copied = { id: '9', assignedInventoryItemIds: ['5', '8'] };
    jest.spyOn(model, 'getListById').mockResolvedValue(copied);
    const assign = jest.spyOn(model, 'assignInventoryItemToList');
    const client = scriptedClient((sql) => {
      if (sql.startsWith('BEGIN') || sql.startsWith('COMMIT') || sql.startsWith('ROLLBACK')) {
        return { rows: [] };
      }
      if (sql.includes('FROM garment_lists')) {
        return {
          rows: [
            {
              team_id: 4,
              checkbox_columns: [{ id: 'inv_5_ordered', group: 'Old sauce' }],
              fit_summary_procurement: { 5: {} },
            },
          ],
        };
      }
      if (sql.includes('INSERT INTO garment_lists')) {
        return { rows: [{ id: 9 }] };
      }
      return { rows: [] };
    });

    await expect(model.duplicateList(req(), 3, { name: '  Copy of list  ' })).resolves.toEqual(
      copied,
    );

    const statements = client.query.mock.calls.map((call) => String(call[0]));
    const joinInsert = statements.find((sql) => sql.includes('garment_list_inventory_items'));
    expect(joinInsert).toMatch(/INSERT INTO garment_list_inventory_items/);
    expect(joinInsert).not.toMatch(/archived_at/);
    expect(statements.join('\n')).not.toMatch(/garment_list_shares/);
    expect(statements.some((sql) => sql.startsWith('COMMIT'))).toBe(true);
    const listInsert = client.query.mock.calls.find((call) =>
      String(call[0]).includes('INSERT INTO garment_lists'),
    );
    expect(listInsert[1][1]).toBe('Copy of list');
    expect(assign).not.toHaveBeenCalled();
    expect(client.release).toHaveBeenCalled();
  });

  it('rolls back when the source list is missing', async () => {
    const getList = jest.spyOn(model, 'getListById');
    const client = scriptedClient((sql) => {
      if (sql.includes('FROM garment_lists')) return { rows: [] };
      return { rows: [] };
    });

    await expect(model.duplicateList(req(), 3, { name: 'Copy' })).rejects.toMatchObject({
      statusCode: 404,
    });

    const statements = client.query.mock.calls.map((call) => String(call[0]));
    expect(statements.some((sql) => sql.startsWith('ROLLBACK'))).toBe(true);
    expect(statements.some((sql) => sql.startsWith('COMMIT'))).toBe(false);
    expect(getList).not.toHaveBeenCalled();
  });

  it('rolls back the new list when copying persons fails', async () => {
    const getList = jest.spyOn(model, 'getListById');
    const client = scriptedClient((sql) => {
      if (sql.includes('FROM garment_lists')) {
        return {
          rows: [{ team_id: null, checkbox_columns: [], fit_summary_procurement: {} }],
        };
      }
      if (sql.includes('INSERT INTO garment_lists')) return { rows: [{ id: 9 }] };
      if (sql.includes('garment_list_persons')) {
        throw new Error('person copy failed');
      }
      return { rows: [] };
    });

    await expect(model.duplicateList(req(), 3, { name: 'Copy' })).rejects.toMatchObject({
      statusCode: 500,
    });

    const statements = client.query.mock.calls.map((call) => String(call[0]));
    expect(statements.some((sql) => sql.includes('garment_list_inventory_items'))).toBe(true);
    expect(statements.some((sql) => sql.startsWith('ROLLBACK'))).toBe(true);
    expect(statements.some((sql) => sql.startsWith('COMMIT'))).toBe(false);
    expect(getList).not.toHaveBeenCalled();
    expect(client.release).toHaveBeenCalled();
  });
});

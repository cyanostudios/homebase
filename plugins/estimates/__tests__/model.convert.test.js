jest.mock('@homebase/core', () => ({
  Logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  Database: { get: jest.fn() },
}));

jest.mock('../pluginAccess', () => ({
  isPluginEnabledForRequest: jest.fn(),
}));

jest.mock('../../invoices/model', () => {
  return jest.fn().mockImplementation(() => ({
    _loadInvoiceNumbering: jest.fn().mockResolvedValue({
      numberPrefix: '',
      numberStart: 1,
      includeYear: true,
    }),
    transformRow: jest.fn((row) => ({
      id: String(row.id),
      invoiceNumber: row.invoice_number,
      estimateId: row.estimate_id ? String(row.estimate_id) : null,
      status: row.status,
    })),
  }));
});

const EstimateModel = require('../model');
const { isPluginEnabledForRequest } = require('../pluginAccess');
const { AppError } = require('../../../server/core/errors/AppError');

function makeReq(pool) {
  return {
    tenantPool: pool,
    session: { user: { id: 1, role: 'user' }, currentTenantUserId: 1 },
  };
}

function mockPool(handlers) {
  let call = 0;
  const client = {
    query: jest.fn(async (sql, params) => {
      const normalized = String(sql).trim().toUpperCase();
      if (normalized === 'BEGIN' || normalized === 'COMMIT' || normalized.startsWith('ROLLBACK')) {
        return { rows: [] };
      }
      const fn = handlers[call];
      call += 1;
      if (typeof fn === 'function') {
        return fn(sql, params);
      }
      return fn;
    }),
    release: jest.fn(),
  };
  return {
    connect: jest.fn(async () => client),
    _client: client,
  };
}

describe('EstimateModel.convertToInvoice', () => {
  let model;

  beforeEach(() => {
    jest.clearAllMocks();
    model = new EstimateModel();
    isPluginEnabledForRequest.mockResolvedValue(true);
  });

  test('403 when invoices plugin disabled', async () => {
    isPluginEnabledForRequest.mockResolvedValue(false);
    await expect(
      model.convertToInvoice(makeReq({ connect: jest.fn() }), '1'),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  test('409 when invoice already linked', async () => {
    const pool = mockPool([{ rows: [{ id: 99 }] }]);
    await expect(model.convertToInvoice(makeReq(pool), '1')).rejects.toMatchObject({
      statusCode: 409,
      existingInvoiceId: '99',
    });
  });

  test('400 when estimate not accepted', async () => {
    const pool = mockPool([
      { rows: [] },
      {
        rows: [
          {
            id: 1,
            status: 'sent',
            estimate_number: '2026-001',
            line_items: [],
            estimate_discount: 0,
            contact_name: 'A',
            currency: 'SEK',
          },
        ],
      },
    ]);
    await expect(model.convertToInvoice(makeReq(pool), '1')).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  test('happy path returns estimate and invoice', async () => {
    const acceptedRow = {
      id: 1,
      estimate_number: '2026-001',
      status: 'accepted',
      contact_id: 2,
      contact_name: 'Acme',
      organization_number: '',
      currency: 'SEK',
      line_items: [{ kind: 'item', quantity: 1, unitPrice: 100, discount: 0, vatRate: 25 }],
      estimate_discount: 0,
      notes: 'N',
      order_number: 'ORD-1',
      delivery_method: 'Post',
      acceptance_reasons: '[]',
      rejection_reasons: '[]',
      subtotal: 100,
      total_discount: 0,
      subtotal_after_discount: 100,
      estimate_discount_amount: 0,
      subtotal_after_estimate_discount: 100,
      total_vat: 25,
      total: 125,
      valid_to: null,
      status_changed_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const pool = mockPool([
      { rows: [] },
      { rows: [acceptedRow] },
      { rows: [] },
      { rows: [] },
      {
        rows: [
          {
            id: 10,
            invoice_number: '2026-001',
            estimate_id: 1,
            status: 'draft',
            line_items: acceptedRow.line_items,
          },
        ],
      },
      {
        rows: [{ ...acceptedRow, status: 'invoiced' }],
      },
    ]);

    const result = await model.convertToInvoice(makeReq(pool), '1');
    expect(result.estimate.status).toBe('invoiced');
    expect(result.invoice.id).toBe('10');
    expect(pool._client.query).toHaveBeenCalledWith('COMMIT');

    const insertCall = pool._client.query.mock.calls.find(
      ([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO invoices'),
    );
    expect(insertCall).toBeDefined();
    expect(insertCall[0]).toMatch(/user_id/i);
    expect(insertCall[1]).toContain(1);
  });
});

describe('EstimateModel.update status', () => {
  let model;

  beforeEach(() => {
    jest.clearAllMocks();
    model = new EstimateModel();
  });

  test('rejects manual invoiced on update', async () => {
    jest.spyOn(model, 'getById').mockResolvedValue({
      id: '1',
      status: 'accepted',
      statusChangedAt: null,
      orderNumber: '',
      deliveryMethod: '',
    });

    await expect(
      model.update(makeReq({}), '1', { status: 'invoiced', lineItems: [] }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test('rejects any update when estimate is already invoiced', async () => {
    jest.spyOn(model, 'getById').mockResolvedValue({
      id: '1',
      status: 'invoiced',
      statusChangedAt: new Date(),
      orderNumber: '',
      deliveryMethod: '',
    });

    await expect(
      model.update(makeReq({}), '1', { status: 'accepted', lineItems: [], notes: 'changed' }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: /cannot be edited/i,
    });
  });
});

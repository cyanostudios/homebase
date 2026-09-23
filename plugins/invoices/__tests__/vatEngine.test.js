const {
  buildVatBreakdown,
  deriveContentProfile,
  FORENKLAD_TOTAL_CEILING_SEK,
  isAllowedVatRate,
  isIssuedStatus,
  validateContentProfile,
  validateVatEngine,
} = require('../vatEngine');
const { hasMlFieldMutation, resolveIssuedStatusTransition } = require('../mlLock');

describe('vatEngine', () => {
  it('isIssuedStatus', () => {
    expect(isIssuedStatus('draft')).toBe(false);
    expect(isIssuedStatus('sent')).toBe(true);
  });

  it('allows only 0/6/12/25', () => {
    expect(isAllowedVatRate(25)).toBe(true);
    expect(isAllowedVatRate(10)).toBe(false);
  });

  it('derives förenklad under SEK ceiling for receipt', () => {
    expect(
      deriveContentProfile({
        invoiceType: 'receipt',
        currency: 'SEK',
        total: FORENKLAD_TOTAL_CEILING_SEK,
      }),
    ).toBe('simplified');
    expect(
      deriveContentProfile({
        invoiceType: 'receipt',
        currency: 'SEK',
        total: FORENKLAD_TOTAL_CEILING_SEK + 1,
      }),
    ).toBe('full');
    expect(deriveContentProfile({ invoiceType: 'invoice', currency: 'SEK', total: 100 })).toBe(
      'full',
    );
  });

  it('rejects simplified invoice profile', () => {
    const result = validateContentProfile({
      invoiceType: 'invoice',
      contentProfile: 'simplified',
      currency: 'SEK',
      total: 100,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('CONTENT_PROFILE_INVALID');
  });

  it('allows non-SEK when issuing', () => {
    const result = validateVatEngine(
      { currency: 'EUR', lineItems: [{ vatRate: 25 }] },
      { supplyDate: '2026-06-01', issuing: true },
    );
    expect(result.ok).toBe(true);
  });

  it('refuses reverse charge posture', () => {
    const result = validateVatEngine(
      { currency: 'SEK', vatMode: 'reverse_charge', lineItems: [{ vatRate: 0 }] },
      { supplyDate: '2026-06-01', issuing: true },
    );
    expect(result.ok).toBe(false);
    expect(result.code).toBe('VAT_POSTURE_REFUSED');
  });

  it('builds per-rate breakdown', () => {
    const rows = buildVatBreakdown(
      [
        { kind: 'item', quantity: 1, unitPrice: 1000, discount: 0, vatRate: 25 },
        { kind: 'item', quantity: 1, unitPrice: 500, discount: 0, vatRate: 12 },
      ],
      0,
    );
    expect(rows).toEqual([
      { rate: 25, taxBase: 1000, vatAmount: 250 },
      { rate: 12, taxBase: 500, vatAmount: 60 },
    ]);
  });
});

describe('mlLock', () => {
  it('detects ML field mutations', () => {
    const current = {
      status: 'sent',
      invoiceType: 'invoice',
      notes: 'a',
      lineItems: [{ id: '1', quantity: 1 }],
      issueDate: '2026-01-01T12:00:00.000Z',
    };
    expect(hasMlFieldMutation(current, { notes: 'a', status: 'canceled' })).toBe(false);
    expect(hasMlFieldMutation(current, { notes: 'b' })).toBe(true);
    expect(hasMlFieldMutation(current, { invoiceType: 'credit_note' })).toBe(true);
    expect(hasMlFieldMutation(current, { issueDate: '2026-01-01T00:00:00.000Z' })).toBe(false);
  });

  it('refuses issued → draft unlock (QA B1)', () => {
    const result = resolveIssuedStatusTransition('sent', 'draft');
    expect(result.ok).toBe(false);
    expect(result.code).toBe('INVOICE_ML_LOCKED');
  });

  it('allows issued workflow statuses and ignores paid client assignment', () => {
    expect(resolveIssuedStatusTransition('sent', 'canceled')).toEqual({
      ok: true,
      status: 'canceled',
    });
    expect(resolveIssuedStatusTransition('sent', 'overdue')).toEqual({
      ok: true,
      status: 'overdue',
    });
    expect(resolveIssuedStatusTransition('sent', 'paid')).toEqual({
      ok: true,
      status: 'sent',
    });
    expect(resolveIssuedStatusTransition('sent', 'paid', { isPastDue: true })).toEqual({
      ok: true,
      status: 'overdue',
    });
    expect(resolveIssuedStatusTransition('sent', 'sent', { isPastDue: true })).toEqual({
      ok: true,
      status: 'overdue',
    });
  });

  it('keeps current status when request omitted', () => {
    expect(resolveIssuedStatusTransition('canceled', undefined)).toEqual({
      ok: true,
      status: 'canceled',
    });
  });
});

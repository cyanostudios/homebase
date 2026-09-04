const { sanitizeClientInvoiceStatus, derivePaymentStatus } = require('../paymentLedger');

describe('sanitizeClientInvoiceStatus', () => {
  it('rejects client paid/partially_paid and keeps current status', () => {
    expect(sanitizeClientInvoiceStatus('paid', 'sent')).toBe('sent');
    expect(sanitizeClientInvoiceStatus('partially_paid', 'overdue')).toBe('overdue');
    expect(sanitizeClientInvoiceStatus('paid', 'draft')).toBe('draft');
  });

  it('keeps payment-derived status only when already on the invoice', () => {
    expect(sanitizeClientInvoiceStatus('paid', 'paid')).toBe('paid');
    expect(sanitizeClientInvoiceStatus('partially_paid', 'partially_paid')).toBe('partially_paid');
    expect(sanitizeClientInvoiceStatus('paid', 'partially_paid')).toBe('partially_paid');
  });

  it('allows non-payment statuses through', () => {
    expect(sanitizeClientInvoiceStatus('sent', 'draft')).toBe('sent');
    expect(sanitizeClientInvoiceStatus('canceled', 'sent')).toBe('canceled');
  });
});

describe('derivePaymentStatus', () => {
  const isPastDue = () => false;

  it('marks paid when ledger covers total', () => {
    expect(
      derivePaymentStatus({
        currentStatus: 'sent',
        amountPaid: 100,
        total: 100,
        dueDate: null,
        isPastDue,
        currentPaidAt: null,
      }).status,
    ).toBe('paid');
  });

  it('marks partially_paid when ledger has a remainder', () => {
    expect(
      derivePaymentStatus({
        currentStatus: 'sent',
        amountPaid: 40,
        total: 100,
        dueDate: null,
        isPastDue,
      }).status,
    ).toBe('partially_paid');
  });

  it('does not forge paid from empty ledger', () => {
    const result = derivePaymentStatus({
      currentStatus: 'paid',
      amountPaid: 0,
      total: 100,
      dueDate: null,
      isPastDue,
      currentPaidAt: '2026-01-01',
    });
    expect(result.status).toBe('sent');
    expect(result.paidAt).toBeNull();
  });

  it('preserves canceled while still reporting amountPaid', () => {
    const result = derivePaymentStatus({
      currentStatus: 'canceled',
      amountPaid: 50,
      total: 100,
      dueDate: null,
      isPastDue,
    });
    expect(result.status).toBe('canceled');
    expect(result.amountPaid).toBe(50);
    expect(result.paidAt).toBeNull();
  });
});

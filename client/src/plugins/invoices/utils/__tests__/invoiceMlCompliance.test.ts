import {
  buildInvoiceStatusUpdatePayload,
  buildInvoiceVatBreakdown,
  canCreateCreditNoteFromInvoiceMl,
  deriveInvoiceContentProfile,
  FORENKLAD_TOTAL_CEILING_SEK,
  getInvoiceStatusSelectOptions,
  isAllowedInvoiceVatRate,
  isInvoiceIssued,
  isInvoiceStatusOnlyPayload,
  resolveInvoiceCurrency,
  resolveInvoiceVatRateFromContact,
  validateInvoiceMlClient,
} from '../invoiceMlCompliance';
import { calculateInvoiceLineItem } from '../../types/invoices';

describe('invoiceMlCompliance', () => {
  it('isInvoiceIssued treats only draft as editable', () => {
    expect(isInvoiceIssued('draft')).toBe(false);
    expect(isInvoiceIssued(null)).toBe(false);
    expect(isInvoiceIssued('sent')).toBe(true);
    expect(isInvoiceIssued('paid')).toBe(true);
  });

  it('hides draft from issued status options (QA B1)', () => {
    expect(getInvoiceStatusSelectOptions('sent')).not.toContain('draft');
    expect(getInvoiceStatusSelectOptions('sent')).toEqual(['sent', 'overdue', 'canceled']);
    expect(getInvoiceStatusSelectOptions('paid')).toEqual(['sent', 'paid', 'overdue', 'canceled']);
    expect(getInvoiceStatusSelectOptions('draft')).toContain('draft');
    expect(getInvoiceStatusSelectOptions('sent', { issuedLocked: false })).toContain('draft');
  });

  it('builds status-only payload for issued updates (QA B2)', () => {
    expect(buildInvoiceStatusUpdatePayload({ id: '1', status: 'sent' }, 'canceled')).toEqual({
      id: '1',
      status: 'canceled',
    });
    expect(buildInvoiceStatusUpdatePayload({ id: '1', status: 'sent' }, 'draft')).toBeNull();
    expect(buildInvoiceStatusUpdatePayload({ id: '1', status: 'draft' }, 'sent')).toBeNull();
  });

  it('detects status-only payloads', () => {
    expect(isInvoiceStatusOnlyPayload({ id: '1', status: 'canceled' })).toBe(true);
    expect(isInvoiceStatusOnlyPayload({ id: '1', status: 'sent', notes: 'x' })).toBe(false);
    expect(isInvoiceStatusOnlyPayload({ status: 'sent' })).toBe(false);
  });

  it('credit notes only from issued standard invoices', () => {
    expect(canCreateCreditNoteFromInvoiceMl({ invoiceType: 'invoice', status: 'sent' })).toBe(true);
    expect(canCreateCreditNoteFromInvoiceMl({ invoiceType: 'invoice', status: 'draft' })).toBe(
      false,
    );
    expect(canCreateCreditNoteFromInvoiceMl({ invoiceType: 'credit_note', status: 'sent' })).toBe(
      false,
    );
  });

  it('derives förenklad only for receipt/cash under SEK ceiling', () => {
    expect(
      deriveInvoiceContentProfile({
        invoiceType: 'invoice',
        currency: 'SEK',
        total: 100,
      }),
    ).toBe('full');
    expect(
      deriveInvoiceContentProfile({
        invoiceType: 'receipt',
        currency: 'SEK',
        total: FORENKLAD_TOTAL_CEILING_SEK,
      }),
    ).toBe('simplified');
    expect(
      deriveInvoiceContentProfile({
        invoiceType: 'receipt',
        currency: 'SEK',
        total: FORENKLAD_TOTAL_CEILING_SEK + 0.01,
      }),
    ).toBe('full');
    expect(
      deriveInvoiceContentProfile({
        invoiceType: 'cash_invoice',
        currency: 'EUR',
        total: 100,
      }),
    ).toBe('full');
  });

  it('allows only 0/6/12/25 VAT rates', () => {
    expect(isAllowedInvoiceVatRate(25)).toBe(true);
    expect(isAllowedInvoiceVatRate(6)).toBe(true);
    expect(isAllowedInvoiceVatRate(10)).toBe(false);
  });

  it('builds per-rate VAT breakdown', () => {
    const lines = [
      calculateInvoiceLineItem({
        id: '1',
        quantity: 1,
        unitPrice: 1000,
        discount: 0,
        vatRate: 25,
      }),
      calculateInvoiceLineItem({
        id: '2',
        quantity: 1,
        unitPrice: 1000,
        discount: 0,
        vatRate: 12,
      }),
    ];
    const rows = buildInvoiceVatBreakdown(lines, 0);
    expect(rows).toHaveLength(2);
    expect(rows[0].rate).toBe(25);
    expect(rows[0].taxBase).toBe(1000);
    expect(rows[0].vatAmount).toBe(250);
    expect(rows[1].rate).toBe(12);
    expect(rows[1].vatAmount).toBe(120);
  });

  it('validate requires credit link and summary; allows non-SEK when issuing', () => {
    expect(
      validateInvoiceMlClient({
        invoiceType: 'credit_note',
        status: 'draft',
        issuing: false,
      }).map((e) => e.field),
    ).toEqual(expect.arrayContaining(['creditedInvoiceId', 'correctionSummary']));

    expect(
      validateInvoiceMlClient({
        invoiceType: 'invoice',
        status: 'sent',
        currency: 'EUR',
        lineItems: [{ vatRate: 25 }],
        issuing: true,
      }).some((e) => e.field === 'currency'),
    ).toBe(false);
  });

  it('resolves currency and contact VAT defaults', () => {
    expect(resolveInvoiceCurrency('eur')).toBe('EUR');
    expect(resolveInvoiceCurrency('GBP')).toBe('SEK');
    expect(resolveInvoiceVatRateFromContact('12')).toBe(12);
    expect(resolveInvoiceVatRateFromContact('0')).toBe(0);
    expect(resolveInvoiceVatRateFromContact('99')).toBe(25);
  });
});

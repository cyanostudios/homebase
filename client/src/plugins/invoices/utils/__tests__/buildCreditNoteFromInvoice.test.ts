import {
  buildCreditNoteCreatePayload,
  canCreateCreditNoteFromInvoice,
} from '../buildCreditNoteFromInvoice';
import type { Invoice } from '../../context/InvoicesContext';

describe('canCreateCreditNoteFromInvoice', () => {
  it('allows only issued standard invoices', () => {
    expect(canCreateCreditNoteFromInvoice({ invoiceType: 'invoice', status: 'sent' })).toBe(true);
    expect(canCreateCreditNoteFromInvoice({ invoiceType: 'invoice', status: 'draft' })).toBe(false);
    expect(canCreateCreditNoteFromInvoice({})).toBe(false);
    expect(canCreateCreditNoteFromInvoice({ invoiceType: 'credit_note', status: 'sent' })).toBe(
      false,
    );
    expect(canCreateCreditNoteFromInvoice({ invoiceType: 'cash_invoice', status: 'sent' })).toBe(
      false,
    );
    expect(canCreateCreditNoteFromInvoice({ invoiceType: 'receipt', status: 'paid' })).toBe(false);
  });
});

describe('buildCreditNoteCreatePayload', () => {
  it('copies positive lines and persists hard credit link fields', () => {
    const original = {
      id: '9',
      contactId: '3',
      contactName: 'Acme',
      organizationNumber: '556677-8899',
      currency: 'SEK',
      paymentTerms: '30',
      orderNumber: 'ORD-1',
      deliveryMethod: 'Post',
      invoiceDiscount: 5,
      notes: 'Thanks',
      invoiceNumber: '2026-010',
      invoiceType: 'invoice',
      status: 'sent',
      amountPaid: 100,
      lineItems: [
        {
          id: 'line-1',
          kind: 'item',
          name: 'Work',
          quantity: 2,
          unitPrice: 500,
        },
      ],
    } as unknown as Invoice;

    const payload = buildCreditNoteCreatePayload(
      original,
      'K-2026-001',
      'Credit against invoice 2026-010',
    );

    expect(payload.invoiceType).toBe('credit_note');
    expect(payload.status).toBe('draft');
    expect(payload.invoiceNumber).toBe('K-2026-001');
    expect(payload.amountPaid).toBe(0);
    expect(payload.contactId).toBe('3');
    expect(payload.contactName).toBe('Acme');
    expect(payload.invoiceDiscount).toBe(5);
    expect(payload.creditedInvoiceId).toBe('9');
    expect(payload.creditedInvoiceNumber).toBe('2026-010');
    expect(payload.correctionSummary).toBe('Credit against invoice 2026-010');
    expect(payload.contentProfile).toBe('full');
    expect(payload.notes).toContain('Thanks');
    expect(payload.notes).toContain('Credit against invoice 2026-010');
    const lines = payload.lineItems as Array<{ quantity: number; unitPrice: number; id: string }>;
    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(2);
    expect(lines[0].unitPrice).toBe(500);
    expect(lines[0].id).not.toBe('line-1');
  });
});

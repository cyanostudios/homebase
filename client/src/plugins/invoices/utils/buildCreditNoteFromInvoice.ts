import type { Invoice } from '../context/InvoicesContext';
import { displayPlainText } from './htmlText';
import { computeDueDateFromPaymentTerms } from './invoiceDueDate';

/** True when Actions may offer “Create credit note” from this document. */
export function canCreateCreditNoteFromInvoice(invoice: { invoiceType?: string | null }): boolean {
  return (invoice.invoiceType || 'invoice') === 'invoice';
}

/**
 * Build create payload for a credit note from an invoice.
 * Line amounts stay positive; `resolveInvoiceTotals` signs the document total negative.
 */
export function buildCreditNoteCreatePayload(
  original: Invoice,
  invoiceNumber: string,
  creditAgainstLabel: string,
): Record<string, unknown> {
  const issueDate = new Date();
  const paymentTerms = original.paymentTerms || '30';
  const dueDate =
    computeDueDateFromPaymentTerms(issueDate, paymentTerms) ??
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const existingNotes = displayPlainText(original.notes || '').trim();
  const notes = existingNotes ? `${existingNotes}\n\n${creditAgainstLabel}` : creditAgainstLabel;

  const lineItems = (original.lineItems || []).map((item: Record<string, unknown>) => ({
    ...item,
    id: `${Date.now()}-${Math.random()}`,
  }));

  return {
    contactId: original.contactId ?? null,
    contactName: original.contactName || '',
    organizationNumber: original.organizationNumber || '',
    currency: original.currency || 'SEK',
    lineItems,
    invoiceDiscount: original.invoiceDiscount || 0,
    notes,
    paymentTerms,
    orderNumber: original.orderNumber || '',
    deliveryMethod: original.deliveryMethod || '',
    issueDate: issueDate.toISOString(),
    dueDate: dueDate.toISOString(),
    invoiceNumber,
    invoiceType: 'credit_note',
    status: 'draft',
    paidAt: null,
    amountPaid: 0,
  };
}

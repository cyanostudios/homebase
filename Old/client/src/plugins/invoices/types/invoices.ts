// client/src/plugins/invoices/types/invoices.ts

export interface ValidationError {
  field: string;
  message: string;
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'canceled';

export interface InvoiceLineItem {
  id?: string;
  name?: string;
  title?: string;            // some UIs use title
  description?: string;
  quantity: number;
  unitPrice: number;
  discount: number;          // percent 0–100
  vatRate: number;           // percent 0–100

  // Calculated fields (kept same names/pattern as estimates)
  lineSubtotal: number;                 // quantity * unitPrice
  discountAmount: number;               // lineSubtotal * (discount/100)
  lineSubtotalAfterDiscount: number;    // lineSubtotal - discountAmount
  vatAmount: number;                    // lineSubtotalAfterDiscount * (vatRate/100)
  lineTotal: number;                    // lineSubtotalAfterDiscount + vatAmount
  sortOrder: number;
}

export interface Invoice {
  id: string;
  invoiceNumber?: string | null;

  contactId?: string | null;
  contactName?: string;
  organizationNumber?: string;

  currency?: string;         // default 'SEK'
  lineItems: InvoiceLineItem[];
  invoiceDiscount: number;   // percent
  notes?: string;
  paymentTerms?: string;

  issueDate?: Date | string | null;
  dueDate?: Date | string | null;

  // Totals (server-calculated, but client mirrors logic)
  subtotal: number;
  totalDiscount: number;
  subtotalAfterDiscount: number;
  invoiceDiscountAmount: number;
  subtotalAfterInvoiceDiscount: number;
  totalVat: number;
  total: number;

  status?: InvoiceStatus;
  invoiceType?: 'invoice' | 'credit_note' | 'cash_invoice' | 'receipt';  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;

  estimateId?: string | null;
}

export interface InvoiceShare {
  id: string;
  invoiceId: string;
  shareToken: string;
  validUntil: Date | string;
  createdAt: Date | string;
  accessedCount: number;
  lastAccessedAt?: Date | string | null;
}

// ===== HELPER FUNCTIONS (mirror estimates) =====

export function calculateInvoiceLineItem(item: Partial<InvoiceLineItem>): InvoiceLineItem {
  const quantity = item.quantity ?? 0;
  const unitPrice = item.unitPrice ?? 0;
  const discount = item.discount ?? 0;
  const vatRate = item.vatRate ?? 25;

  const lineSubtotal = quantity * unitPrice;
  const discountAmount = lineSubtotal * (discount / 100);
  const lineSubtotalAfterDiscount = lineSubtotal - discountAmount;
  const vatAmount = lineSubtotalAfterDiscount * (vatRate / 100);
  const lineTotal = lineSubtotalAfterDiscount + vatAmount;

  return {
    id: item.id || '',
    name: item.name,
    title: item.title,
    description: item.description || '',
    quantity,
    unitPrice,
    discount,
    vatRate,
    lineSubtotal: Math.round(lineSubtotal * 100) / 100,
    discountAmount: Math.round(discountAmount * 100) / 100,
    lineSubtotalAfterDiscount: Math.round(lineSubtotalAfterDiscount * 100) / 100,
    vatAmount: Math.round(vatAmount * 100) / 100,
    lineTotal: Math.round(lineTotal * 100) / 100,
    sortOrder: item.sortOrder ?? 0,
  };
}

export function calculateInvoiceTotals(
  lineItems: InvoiceLineItem[],
  invoiceDiscount: number = 0
): {
  subtotal: number;
  totalDiscount: number;
  subtotalAfterDiscount: number;
  invoiceDiscountAmount: number;
  subtotalAfterInvoiceDiscount: number;
  totalVat: number;
  total: number;
} {
  let subtotal = 0;
  let totalDiscount = 0;

  // Sum up line-level amounts (like estimates)
  lineItems.forEach(item => {
    const lineSubtotal = item.lineSubtotal ?? ((item.quantity || 0) * (item.unitPrice || 0));
    const discountAmount = item.discountAmount ?? 0;
    subtotal += lineSubtotal;
    totalDiscount += discountAmount;
  });

  const subtotalAfterDiscount = subtotal - totalDiscount;

  // Invoice-level discount on subtotal after line discounts
  const invoiceDiscountAmount = subtotalAfterDiscount * (invoiceDiscount / 100);
  const subtotalAfterInvoiceDiscount = subtotalAfterDiscount - invoiceDiscountAmount;

  // Proportional VAT allocation based on final net
  let totalVat = 0;
  lineItems.forEach(item => {
    const lineSubtotal = item.lineSubtotal ?? ((item.quantity || 0) * (item.unitPrice || 0));
    const lineDiscountAmount = item.discountAmount ?? 0;
    const lineAfterDiscount = lineSubtotal - lineDiscountAmount;

    if (subtotalAfterDiscount > 0) {
      const proportion = lineAfterDiscount / subtotalAfterDiscount;
      const finalLineAmount = subtotalAfterInvoiceDiscount * proportion;
      const vatAmount = finalLineAmount * ((item.vatRate ?? 25) / 100);
      totalVat += vatAmount;
    }
  });

  const total = subtotalAfterInvoiceDiscount + totalVat;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    totalDiscount: Math.round(totalDiscount * 100) / 100,
    subtotalAfterDiscount: Math.round(subtotalAfterDiscount * 100) / 100,
    invoiceDiscountAmount: Math.round(invoiceDiscountAmount * 100) / 100,
    subtotalAfterInvoiceDiscount: Math.round(subtotalAfterInvoiceDiscount * 100) / 100,
    totalVat: Math.round(totalVat * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

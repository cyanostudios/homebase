// client/src/plugins/invoices/types/invoices.ts

export interface ValidationError {
  field: string;
  message: string;
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'canceled' | 'partially_paid';

export interface InvoiceLineItem {
  id?: string;
  name?: string;
  title?: string; // some UIs use title
  description?: string;
  /** `item` = priced row; `text` = free-text note row (no qty/price). */
  kind?: 'item' | 'text';
  quantity: number;
  /** Display unit next to qty (e.g. piece, hour, day, week). */
  unit?: string;
  unitPrice: number;
  discount: number; // percent 0–100
  vatRate: number; // percent 0–100

  // Calculated fields (kept same names/pattern as estimates)
  lineSubtotal: number; // quantity * unitPrice
  discountAmount: number; // lineSubtotal * (discount/100)
  lineSubtotalAfterDiscount: number; // lineSubtotal - discountAmount
  vatAmount: number; // lineSubtotalAfterDiscount * (vatRate/100)
  lineTotal: number; // lineSubtotalAfterDiscount + vatAmount
  sortOrder: number;
}

export const INVOICE_LINE_ITEM_UNITS = ['piece', 'hour', 'day', 'week'] as const;
export type InvoiceLineItemUnit = (typeof INVOICE_LINE_ITEM_UNITS)[number];
/** Empty unit is allowed; UI shows "-" for blank. */
export const DEFAULT_INVOICE_LINE_ITEM_UNIT = '';

export interface Invoice {
  id: string;
  invoiceNumber?: string | null;

  contactId?: string | null;
  contactName?: string;
  organizationNumber?: string;

  currency?: string; // default 'SEK'
  lineItems: InvoiceLineItem[];
  invoiceDiscount: number; // percent
  notes?: string;
  paymentTerms?: string;
  orderNumber?: string;
  deliveryMethod?: string;

  issueDate?: Date | string | null;
  dueDate?: Date | string | null;

  // Totals — denormalized cache. Always derive via resolveInvoiceTotals / withResolvedInvoiceTotals.
  subtotal: number;
  totalDiscount: number;
  subtotalAfterDiscount: number;
  invoiceDiscountAmount: number;
  subtotalAfterInvoiceDiscount: number;
  totalVat: number;
  total: number;

  status?: InvoiceStatus;
  invoiceType?: 'invoice' | 'credit_note' | 'cash_invoice' | 'receipt';
  paidAt?: Date | string | null;
  amountPaid?: number;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;

  estimateId?: string | null;
}

export interface InvoicePayment {
  id: string;
  invoiceId: string;
  amount: number;
  paidOn: Date | string;
  reference?: string;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
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
  const kind = item.kind === 'text' ? 'text' : 'item';

  if (kind === 'text') {
    return {
      id: item.id || '',
      name: item.name,
      title: item.title,
      description: item.description || '',
      kind: 'text',
      quantity: 0,
      unit: '',
      unitPrice: 0,
      discount: 0,
      vatRate: 0,
      lineSubtotal: 0,
      discountAmount: 0,
      lineSubtotalAfterDiscount: 0,
      vatAmount: 0,
      lineTotal: 0,
      sortOrder: item.sortOrder ?? 0,
    };
  }

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
    kind: 'item',
    quantity,
    unit: typeof item.unit === 'string' ? item.unit : DEFAULT_INVOICE_LINE_ITEM_UNIT,
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

/** @deprecated Prefer `resolveInvoiceTotals` / `calculateInvoiceTotals` from `../utils/invoiceTotals`. */
export {
  calculateInvoiceTotals,
  resolveInvoiceTotals,
  withResolvedInvoiceTotals,
} from '../utils/invoiceTotals';
export type { InvoiceTotals, InvoiceTotalsSource } from '../utils/invoiceTotals';

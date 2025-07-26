export interface ValidationError {
  field: string;
  message: string;
}

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number; // Discount percentage (0-100)
  vatRate: number; // Default 25%
  lineSubtotal: number; // quantity * unitPrice (calculated)
  discountAmount: number; // lineSubtotal * (discount/100) (calculated)
  lineSubtotalAfterDiscount: number; // lineSubtotal - discountAmount (calculated)
  vatAmount: number; // lineSubtotalAfterDiscount * (vatRate/100) (calculated)
  lineTotal: number; // lineSubtotalAfterDiscount + vatAmount (calculated)
  sortOrder: number; // For drag-drop ordering
}

export interface Estimate {
  id: string;
  estimateNumber: string; // "2025-001" format
  contactId: string | null;
  contactName: string;
  organizationNumber: string;
  currency: string; // Default "SEK"
  lineItems: LineItem[];
  estimateDiscount: number; // Estimate-level discount percentage
  notes: string;
  validTo: Date;
  subtotal: number; // Auto-calculated (sum of lineSubtotal)
  totalDiscount: number; // Auto-calculated (sum of discountAmount)
  subtotalAfterDiscount: number; // Auto-calculated (subtotal - totalDiscount)
  estimateDiscountAmount: number; // subtotalAfterDiscount * (estimateDiscount/100)
  subtotalAfterEstimateDiscount: number; // subtotalAfterDiscount - estimateDiscountAmount
  totalVat: number; // Auto-calculated (sum of vatAmount on final prices)
  total: number; // Auto-calculated (subtotalAfterEstimateDiscount + totalVat)
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

export interface EstimateFormValues {
  contactId: string | null;
  contactName: string;
  organizationNumber: string;
  currency: string;
  lineItems: LineItem[];
  estimateDiscount: number; // Estimate-level discount
  notes: string;
  validTo: Date;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
}

// === SHARING INTERFACES ===

export interface EstimateShare {
  id: string;
  estimateId: string;
  shareToken: string;
  validUntil: Date;
  createdAt: Date;
  accessedCount: number;
  lastAccessedAt?: Date;
}

export interface CreateShareRequest {
  estimateId: string;
  validUntil: Date;
}

export interface PublicEstimate extends Estimate {
  shareValidUntil: Date;
  accessedCount: number;
}

// === EXISTING INTERFACES ===

export interface Contact {
  id: string;
  contactNumber: string;
  contactType: 'company' | 'private';
  companyName: string;
  organizationNumber?: string;
  email?: string;
  phone?: string;
  website?: string;
  taxRate?: string;
  paymentTerms?: string;
  currency: string;
}

// Helper functions for calculations
export function calculateLineItem(item: Partial<LineItem>): LineItem {
  const quantity = item.quantity || 0;
  const unitPrice = item.unitPrice || 0;
  const discount = item.discount || 0;
  const vatRate = item.vatRate || 25;
  
  const lineSubtotal = quantity * unitPrice;
  const discountAmount = lineSubtotal * (discount / 100);
  const lineSubtotalAfterDiscount = lineSubtotal - discountAmount;
  const vatAmount = lineSubtotalAfterDiscount * (vatRate / 100);
  const lineTotal = lineSubtotalAfterDiscount + vatAmount;
  
  return {
    id: item.id || '',
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
    sortOrder: item.sortOrder || 0,
  };
}

export function calculateEstimateTotals(lineItems: LineItem[]): {
  subtotal: number;
  totalDiscount: number;
  subtotalAfterDiscount: number;
  totalVat: number;
  total: number;
} {
  let subtotal = 0;
  let totalDiscount = 0;
  let totalVat = 0;
  
  lineItems.forEach(item => {
    const lineSubtotal = item.lineSubtotal || ((item.quantity || 0) * (item.unitPrice || 0));
    const discountAmount = item.discountAmount || 0;
    const vatAmount = item.vatAmount || (lineSubtotal * ((item.vatRate || 25) / 100));
    
    subtotal += lineSubtotal;
    totalDiscount += discountAmount;
    totalVat += vatAmount;
  });
  
  const subtotalAfterDiscount = subtotal - totalDiscount;
  const total = subtotalAfterDiscount + totalVat;
  
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    totalDiscount: Math.round(totalDiscount * 100) / 100,
    subtotalAfterDiscount: Math.round(subtotalAfterDiscount * 100) / 100,
    totalVat: Math.round(totalVat * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}
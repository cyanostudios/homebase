export interface ValidationError {
  field: string;
  message: string;
}

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number; // NEW: Discount percentage (0-100)
  vatRate: number; // Default 25%
  lineSubtotal: number; // quantity * unitPrice (calculated)
  discountAmount: number; // NEW: lineSubtotal * (discount/100) (calculated)
  lineSubtotalAfterDiscount: number; // NEW: lineSubtotal - discountAmount (calculated)
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
  notes: string;
  validTo: Date;
  subtotal: number; // Auto-calculated (sum of lineSubtotal)
  totalDiscount: number; // NEW: Auto-calculated (sum of discountAmount)
  subtotalAfterDiscount: number; // NEW: Auto-calculated (subtotal - totalDiscount)
  totalVat: number; // Auto-calculated (sum of vatAmount)
  total: number; // Auto-calculated (subtotalAfterDiscount + totalVat)
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
  notes: string;
  validTo: Date;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
}

export interface Contact {
  id: string;
  contactNumber: string;
  contactType: 'company' | 'private';
  companyName: string;
  organizationNumber?: string;
  currency: string;
}

// Helper functions for calculations
export function calculateLineItem(item: Partial<LineItem>): LineItem {
  const quantity = item.quantity || 0;
  const unitPrice = item.unitPrice || 0;
  const discount = item.discount || 0; // NEW: Default 0% discount
  const vatRate = item.vatRate || 25;
  
  const lineSubtotal = quantity * unitPrice;
  const discountAmount = lineSubtotal * (discount / 100); // NEW: Calculate discount amount
  const lineSubtotalAfterDiscount = lineSubtotal - discountAmount; // NEW: Subtotal after discount
  const vatAmount = lineSubtotalAfterDiscount * (vatRate / 100); // VAT on discounted amount
  const lineTotal = lineSubtotalAfterDiscount + vatAmount;
  
  return {
    id: item.id || '',
    description: item.description || '',
    quantity,
    unitPrice,
    discount, // NEW
    vatRate,
    lineSubtotal: Math.round(lineSubtotal * 100) / 100,
    discountAmount: Math.round(discountAmount * 100) / 100, // NEW
    lineSubtotalAfterDiscount: Math.round(lineSubtotalAfterDiscount * 100) / 100, // NEW
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
    // Handle old estimates that don't have discount fields
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
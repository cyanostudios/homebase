// client/src/plugins/estimates/types/estimate.ts

export interface LineItem {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    vatRate: number; // Default 25%
    lineSubtotal: number; // quantity * unitPrice (calculated)
    vatAmount: number; // lineSubtotal * (vatRate/100) (calculated)
    lineTotal: number; // lineSubtotal + vatAmount (calculated)
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
    subtotal: number; // Auto-calculated
    totalVat: number; // Auto-calculated
    total: number; // Auto-calculated
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
    const vatRate = item.vatRate || 25;
    
    const lineSubtotal = quantity * unitPrice;
    const vatAmount = lineSubtotal * (vatRate / 100);
    const lineTotal = lineSubtotal + vatAmount;
    
    return {
      id: item.id || '',
      description: item.description || '',
      quantity,
      unitPrice,
      vatRate,
      lineSubtotal: Math.round(lineSubtotal * 100) / 100,
      vatAmount: Math.round(vatAmount * 100) / 100,
      lineTotal: Math.round(lineTotal * 100) / 100,
      sortOrder: item.sortOrder || 0,
    };
  }
  
  export function calculateEstimateTotals(lineItems: LineItem[]): {
    subtotal: number;
    totalVat: number;
    total: number;
  } {
    let subtotal = 0;
    let totalVat = 0;
    
    lineItems.forEach(item => {
      subtotal += item.lineSubtotal;
      totalVat += item.vatAmount;
    });
    
    const total = subtotal + totalVat;
    
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      totalVat: Math.round(totalVat * 100) / 100,
      total: Math.round(total * 100) / 100,
    };
  }
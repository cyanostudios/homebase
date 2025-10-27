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

// === STATUS REASON INTERFACES ===

export interface StatusReason {
  id: string;
  label: string;
  category: 'accepted' | 'rejected';
}

export const ACCEPTANCE_REASONS: StatusReason[] = [
  { id: 'price_competitive', label: 'Competitive pricing', category: 'accepted' },
  { id: 'good_value', label: 'Good value for money', category: 'accepted' },
  { id: 'trusted_vendor', label: 'Trusted vendor/relationship', category: 'accepted' },
  { id: 'quality_service', label: 'High quality service expected', category: 'accepted' },
  { id: 'timeline_suitable', label: 'Timeline meets requirements', category: 'accepted' },
  { id: 'recommended', label: 'Recommended by others', category: 'accepted' },
  { id: 'urgent_need', label: 'Urgent business need', category: 'accepted' },
  { id: 'scope_perfect', label: 'Scope matches perfectly', category: 'accepted' },
];

export const REJECTION_REASONS: StatusReason[] = [
  { id: 'price_too_high', label: 'Price too high', category: 'rejected' },
  { id: 'budget_constraints', label: 'Budget constraints', category: 'rejected' },
  { id: 'timeline_too_long', label: 'Timeline too long', category: 'rejected' },
  { id: 'scope_mismatch', label: "Scope doesn't match needs", category: 'rejected' },
  { id: 'found_alternative', label: 'Found better alternative', category: 'rejected' },
  { id: 'project_cancelled', label: 'Project cancelled/postponed', category: 'rejected' },
  { id: 'internal_solution', label: 'Decided on internal solution', category: 'rejected' },
  { id: 'vendor_concerns', label: 'Concerns about vendor capability', category: 'rejected' },
  { id: 'terms_unacceptable', label: 'Terms and conditions unacceptable', category: 'rejected' },
];

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
  // NEW: Status reason fields
  acceptanceReasons?: string[]; // Array of reason IDs
  rejectionReasons?: string[]; // Array of reason IDs
  statusChangedAt?: Date; // When status was last changed
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
  // NEW: Include status reasons in form values
  acceptanceReasons?: string[];
  rejectionReasons?: string[];
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

export function calculateEstimateTotals(
  lineItems: LineItem[],
  estimateDiscount: number = 0,
): {
  subtotal: number;
  totalDiscount: number;
  subtotalAfterDiscount: number;
  estimateDiscountAmount: number;
  subtotalAfterEstimateDiscount: number;
  totalVat: number;
  total: number;
} {
  let subtotal = 0;
  let totalDiscount = 0;

  // Calculate line item totals first
  lineItems.forEach((item) => {
    const lineSubtotal = item.lineSubtotal || (item.quantity || 0) * (item.unitPrice || 0);
    const discountAmount = item.discountAmount || 0;

    subtotal += lineSubtotal;
    totalDiscount += discountAmount;
  });

  // Calculate subtotal after line item discounts
  const subtotalAfterDiscount = subtotal - totalDiscount;

  // NEW: Calculate estimate-level discount
  const estimateDiscountAmount = subtotalAfterDiscount * (estimateDiscount / 100);
  const subtotalAfterEstimateDiscount = subtotalAfterDiscount - estimateDiscountAmount;

  // Calculate VAT on the final amount (after all discounts)
  let totalVat = 0;
  lineItems.forEach((item) => {
    // Recalculate VAT based on proportional share of final subtotal
    const lineSubtotal = item.lineSubtotal || (item.quantity || 0) * (item.unitPrice || 0);
    const lineDiscountAmount = item.discountAmount || 0;
    const lineAfterDiscount = lineSubtotal - lineDiscountAmount;

    if (subtotalAfterDiscount > 0) {
      // Calculate this line's proportion of the subtotal after line discounts
      const proportion = lineAfterDiscount / subtotalAfterDiscount;
      // Apply that proportion to the final subtotal after estimate discount
      const finalLineAmount = subtotalAfterEstimateDiscount * proportion;
      // Calculate VAT on the final amount
      const vatAmount = finalLineAmount * ((item.vatRate || 25) / 100);
      totalVat += vatAmount;
    }
  });

  const total = subtotalAfterEstimateDiscount + totalVat;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    totalDiscount: Math.round(totalDiscount * 100) / 100,
    subtotalAfterDiscount: Math.round(subtotalAfterDiscount * 100) / 100,
    estimateDiscountAmount: Math.round(estimateDiscountAmount * 100) / 100,
    subtotalAfterEstimateDiscount: Math.round(subtotalAfterEstimateDiscount * 100) / 100,
    totalVat: Math.round(totalVat * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

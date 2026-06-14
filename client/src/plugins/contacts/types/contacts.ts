/** Type badge colors — matches ContactView detail. */
export const CONTACT_TYPE_COLORS = {
  company: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
  private: 'bg-green-50/50 text-green-700 dark:text-green-300 dark:bg-green-950/30',
} as const;

export const CONTACT_TYPE_BADGE_CLASS = 'border-0 rounded-md px-2 py-0.5 text-xs font-semibold';

export interface Contact {
  id: string;
  contactNumber: string;
  contactType: 'company' | 'private';
  companyName: string;
  companyType?: string;
  organizationNumber?: string;
  vatNumber?: string;
  personalNumber?: string;
  contactPersons: any[];
  addresses: any[];
  email: string;
  phone: string;
  phone2: string;
  website: string;
  taxRate: string;
  paymentTerms: string;
  currency: string;
  fTax: string;
  notes: string;
  tags?: string[];
  isAssignable?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ValidationError {
  field: string;
  message: string;
}

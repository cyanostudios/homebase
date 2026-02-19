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
  createdAt: Date;
  updatedAt: Date;
}

export interface ValidationError {
  field: string;
  message: string;
}

export const CONTACT_TYPE_COLORS: Record<'company' | 'private', string> = {
  company: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
  private: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
};

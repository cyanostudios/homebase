// Product MVP types + temporary legacy fields for smooth migration.
// Keep comments in English for clarity.

import type { ValidationError } from '@/plugins/contacts/types/contacts';
export type { ValidationError };

// Canonical Product interface (new schema)
export interface Product {
  id: string;

  // New MVP fields (camelCase for frontend)
  productNumber: string | null;   // maps to product_number
  sku: string | null;
  title: string;                  // required
  description: string | null;
  status: 'for sale' | 'paused';
  quantity: number;
  priceAmount: number;            // maps to price_amount
  currency: string;               // ISO-4217, e.g. "SEK"
  vatRate: number;                // e.g. 25
  mainImage: string | null;       // URL
  images: string[];               // array of URLs
  categories: string[];           // array of strings
  brand: string | null;
  gtin: string | null;

  createdAt: Date;
  updatedAt: Date;

  // ---- TEMP: Legacy contact-style fields kept to avoid breakage while migrating UI ----
  contactNumber?: string;
  contactType?: string;
  companyName?: string;
  companyType?: string;
  organizationNumber?: string;
  vatNumber?: string;
  personalNumber?: string;
  contactPersons?: any[];
  addresses?: any[];
  email?: string;
  phone?: string;
  phone2?: string;
  website?: string;
  taxRate?: string;
  paymentTerms?: string;
  fTax?: string;
  notes?: string;
}

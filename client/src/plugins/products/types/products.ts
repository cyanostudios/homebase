// Product MVP types (no legacy dependencies)

export type ValidationError = {
  field: string;
  message: string;
};

export interface Product {
  id: string;

  // MVP fields (camelCase for frontend)
  productNumber: string | null; // maps to product_number
  sku: string | null;
  title: string;                // required
  description: string | null;
  status: 'for sale' | 'draft' | 'archived';
  quantity: number;
  priceAmount: number;          // maps to price_amount
  currency: string;             // ISO-4217, e.g. "SEK"
  vatRate: number;              // e.g. 25
  mainImage: string | null;     // URL
  images: string[];             // array of URLs
  categories: string[];         // array of strings
  brand: string | null;
  gtin: string | null;

  createdAt: Date | null;
  updatedAt: Date | null;
}

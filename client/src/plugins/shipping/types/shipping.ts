export interface ValidationError {
  field: string;
  message: string;
}

export type LabelFormatMode = 'PDF' | 'ZPL' | 'BOTH';

export interface ShippingSettings {
  bookingUrl: string;
  authScheme: string;
  integrationId: string;
  apiKey: string;
  apiSecret: string;
  apiKeyHeaderName: string;
  labelFormat: LabelFormatMode;
  connected: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface ShippingSender {
  id: string;
  name: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  contactName: string;
  contactPhone: string;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface ShippingServicePreset {
  id: string;
  code: string;
  name: string;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface BookPostnordResultItem {
  orderId: string;
  trackingNumber: string | null;
  labelPdf: string | null;
  labelZpl: string | null;
  error: string | null;
}

export interface BookPostnordResponse {
  results: BookPostnordResultItem[];
  updatedOrderIds: string[];
  defaultWeightKg: number;
}

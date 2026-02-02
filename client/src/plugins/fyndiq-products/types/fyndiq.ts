// client/src/plugins/fyndiq-products/types/fyndiq.ts

export interface FyndiqSettings {
  id?: string;
  apiKey: string;
  apiSecret: string;
  connected: boolean;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
}

export interface FyndiqTestResult {
  ok: boolean;
  message?: string;
  error?: string;
}

export interface FyndiqExportResult {
  ok: boolean;
  endpoint: string;
  counts?: { requested: number; success: number; error: number };
  statusLookup?: any;
  result?: any;
  deleted?: number;
  items?: Array<{ productId: string; status: string; error?: string }>;
}

export interface ValidationError {
  field: string;
  message: string;
}


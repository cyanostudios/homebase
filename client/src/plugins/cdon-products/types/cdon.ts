// client/src/plugins/cdon-products/types/cdon.ts

export interface CdonSettings {
  id?: string;
  apiKey: string;
  apiSecret: string;
  connected: boolean;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
}

export interface CdonTestResult {
  ok: boolean;
  message?: string;
  error?: string;
}

export interface CdonExportResult {
  ok: boolean;
  endpoint: string;
  counts?: { requested: number; success: number; error: number };
  receipts?: Record<string, { endpoint: string; status: number; receipt: string | null }>;
  deleted?: number;
  items?: Array<{ productId: string; status: string; error?: string }>;
}

export interface ValidationError {
  field: string;
  message: string;
}


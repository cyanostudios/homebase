export interface ValidationError {
  field: string;
  message: string;
}

export interface ChannelSummary {
  id: string; // same as 'channel'
  channel: string; // e.g., 'woocommerce', 'fyndiq', 'cdon'
  configured: boolean; // has required settings/credentials
  mappedCount: number; // rows in channel_product_map for this channel
  enabledCount: number; // products currently enabled for this channel
  status: {
    success: number; // last sync successes
    error: number; // last sync errors
    queued: number; // queued sync jobs
    idle: number; // no-op/unchanged
  };
  lastSyncedAt?: Date | string | null;
}

// Individual row in channel_product_map (for reading status per product/channel)
export interface ChannelMapRow {
  id: string;
  user_id: string;
  product_id: string;
  channel: string;
  enabled: boolean;
  external_id: string | null;
  last_synced_at: string | null;
  last_sync_status: 'success' | 'error' | 'queued' | 'idle' | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChannelErrorLogItem {
  id: string;
  channel: string;
  productId: string | null;
  message: string | null;
  createdAt: Date | string | null;
}

export interface ChannelInstance {
  id: string;
  channel: string;
  instanceKey: string;
  market: string | null;
  label: string | null;
  credentials: any | null;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
}

export interface ChannelProductOverride {
  id: string;
  productId: string;
  channel: string;
  instanceId: string | null;
  instanceKey: string;
  market: string | null;
  label: string | null;
  active: boolean;
  priceAmount: number | null;
  currency: string | null;
  vatRate: number | null;
  category: string | null;
  updatedAt: Date | string | null;
}

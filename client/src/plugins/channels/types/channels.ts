export interface ValidationError {
  field: string;
  message: string;
}

export interface ChannelSummary {
  id: string;                     // same as 'channel'
  channel: string;                // e.g., 'woocommerce', 'fyndiq', 'cdon'
  configured: boolean;            // has required settings/credentials
  mappedCount: number;            // rows in channel_product_map for this channel
  enabledCount: number;           // products currently enabled for this channel
  status: {
    success: number;              // last sync successes
    error: number;                // last sync errors
    queued: number;               // queued sync jobs
    idle: number;                 // no-op/unchanged
  };
  lastSyncedAt?: Date | string | null;
}

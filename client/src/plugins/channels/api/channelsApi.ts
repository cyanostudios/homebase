// client/src/plugins/channels/api/channelsApi.ts
// Channels API client: lists channel summaries and toggles per-product enable/disable.

export type ApiFieldError = { field: string; message: string };

export class TemplateApi {
  constructor(private basePath: string) {}

  private async request(path: string, options: RequestInit = {}) {
    let response: Response;
    try {
      response = await fetch(`${this.basePath}${path}`, {
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        credentials: 'include',
        ...options,
      });
    } catch {
      const err: any = new Error('Network unreachable');
      err.status = 0;
      throw err;
    }

    if (!response.ok) {
      let payload: any = null;
      try { payload = await response.json(); } catch {}

      const err: any = new Error(
        response.status === 409 && payload?.errors?.[0]?.message
          ? payload.errors[0].message
          : (payload?.error || response.statusText || 'Request failed')
      );
      err.status = response.status;
      if (payload?.errors) err.errors = payload.errors as ApiFieldError[];
      throw err;
    }

    const text = await response.text();
    return text ? JSON.parse(text) : {};
  }

  // GET /api/channels — list channel summaries
  getChannels() {
    return this.request('/');
  }

  // PUT /api/channels/map — per-product enable/disable for a channel
  // Body: { productId: string, channel: string, enabled: boolean }
  setProductEnabled(body: { productId: string; channel: string; enabled: boolean }) {
    return this.request('/map', {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }
}

export const channelsApi = new TemplateApi('/api/channels');

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

// Hook passthrough (kept for compatibility if some code imports it here)
import { useChannelsContext } from '../context/ChannelsContext';
export function useChannels() {
  return useChannelsContext();
}

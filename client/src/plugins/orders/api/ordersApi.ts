import type { OrderDetails, OrderListItem, OrderStatus } from '../types/orders';

export type ApiFieldError = { field: string; message: string };

export interface OrdersListFilters {
  status?: string;
  channel?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

class OrdersApi {
  private csrfToken: string | null = null;
  private basePath = '/api/orders';

  private async getCsrfToken(): Promise<string> {
    if (this.csrfToken) return this.csrfToken;
    const response = await fetch('/api/csrf-token', { credentials: 'include' });
    const data = await response.json();
    this.csrfToken = data.csrfToken;
    return this.csrfToken;
  }

  private async request(path: string, options: RequestInit = {}) {
    let response: Response;
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(((options.headers as Record<string, string>) || {}) as Record<string, string>),
      };

      if (options.method && ['POST', 'PUT', 'DELETE'].includes(options.method)) {
        headers['X-CSRF-Token'] = await this.getCsrfToken();
      }

      response = await fetch(`${this.basePath}${path}`, {
        headers,
        credentials: 'include',
        ...options,
      });
    } catch {
      const err: any = new Error('Network unreachable');
      err.status = 0;
      throw err;
    }

    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;

    if (!response.ok) {
      const err: any = new Error(payload?.error || payload?.message || response.statusText || 'Request failed');
      err.status = response.status;
      if (payload?.errors) err.errors = payload.errors as ApiFieldError[];
      if (payload?.details) err.details = payload.details;
      throw err;
    }

    return payload ?? {};
  }

  async list(filters: OrdersListFilters = {}): Promise<OrderListItem[]> {
    const qs = new URLSearchParams();
    if (filters.status) qs.set('status', filters.status);
    if (filters.channel) qs.set('channel', filters.channel);
    if (filters.from) qs.set('from', filters.from);
    if (filters.to) qs.set('to', filters.to);
    if (filters.limit != null) qs.set('limit', String(filters.limit));
    if (filters.offset != null) qs.set('offset', String(filters.offset));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return (await this.request(`/${suffix}`)) as OrderListItem[];
  }

  async get(id: string): Promise<OrderDetails> {
    return (await this.request(`/${encodeURIComponent(id)}`)) as OrderDetails;
  }

  async updateStatus(
    id: string,
    data: { status: OrderStatus; carrier?: string; trackingNumber?: string },
  ): Promise<OrderListItem> {
    return (await this.request(`/${encodeURIComponent(id)}/status`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })) as OrderListItem;
  }

  // Internal/testing: normalized ingest
  async ingest(data: any): Promise<{ ok: true; created: boolean; orderId: number | null }> {
    return (await this.request('/ingest', { method: 'POST', body: JSON.stringify(data) })) as any;
  }

  // Delete all orders for current user
  async deleteAll(): Promise<{ ok: true; deletedCount: number }> {
    return (await this.request('/', { method: 'DELETE' })) as any;
  }

  /** Trigger quick-sync (background). Returns { started: boolean, reason?: 'fresh'|'locked' }. */
  async sync(): Promise<{ started: boolean; reason?: string }> {
    return (await this.request('/sync', { method: 'POST' })) as any;
  }

  /** Poll to know if sync is still running (for UI spinner). */
  async syncStatus(): Promise<{ busy: boolean }> {
    return (await this.request('/sync/status')) as any;
  }

  // Renumber order_number by placed_at (oldest = 1, newest = highest) across all channels
  async renumber(): Promise<{ ok: true; renumbered: number }> {
    return (await this.request('/renumber', { method: 'POST' })) as any;
  }

  // Batch update status for multiple orders
  async batchUpdateStatus(
    ids: string[],
    data: { status: OrderStatus; carrier?: string; trackingNumber?: string },
  ): Promise<{ ok: true; requested: number; updated: number; updatedIds: string[] }> {
    return (await this.request('/batch/status', {
      method: 'PUT',
      body: JSON.stringify({ ids, ...data }),
    })) as any;
  }
}

export const ordersApi = new OrdersApi();


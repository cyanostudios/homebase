import { DEFAULT_LIST_PAGE_SIZE } from '@/core/settings/listPageSizes';

import {
  DEFAULT_ORDER_LIST_SEARCH_SCOPE,
  type OrderListSearchScope,
} from '../constants/orderListSearchScopes';
import type {
  OrderDetails,
  OrderListItem,
  OrderStatus,
  OrdersListSortField,
  OrdersListSortOrder,
} from '../types/orders';

export type ApiFieldError = { field: string; message: string };

export interface OrdersListFilters {
  status?: string;
  channel?: string;
  /** With `channel`: match `orders.channel_instance_id` (enabled channel_instances row). */
  channelInstanceId?: number;
  from?: string;
  to?: string;
  /** Server-side search: order fields + orderrader/produkter (titel, artikelnr, SKU, EAN, GTIN) enligt `searchIn`. */
  q?: string;
  /** When `q` is set: narrow which columns are searched (default all). */
  searchIn?: OrderListSearchScope;
  sort?: OrdersListSortField;
  order?: OrdersListSortOrder;
  limit?: number;
  offset?: number;
}

class OrdersApi {
  private csrfToken: string | null = null;
  private basePath = '/api/orders';

  private async getCsrfToken(): Promise<string> {
    if (this.csrfToken) {
      return this.csrfToken;
    }
    const response = await fetch('/api/csrf-token', { credentials: 'include' });
    const data = await response.json();
    this.csrfToken = data.csrfToken ?? null;
    if (this.csrfToken === null) {
      throw new Error('CSRF token not returned by server');
    }
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
        ...options,
        headers,
        credentials: 'include',
      });
    } catch {
      const err: any = new Error('Network unreachable');
      err.status = 0;
      throw err;
    }

    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;

    if (!response.ok) {
      const message =
        Array.isArray(payload?.errors) && payload.errors.length > 0
          ? payload.errors[0].message
          : payload?.error || payload?.message || response.statusText || 'Request failed';
      const err: any = new Error(message);
      err.status = response.status;
      if (payload?.errors) {
        err.errors = payload.errors as ApiFieldError[];
      }
      if (payload?.details) {
        err.details = payload.details;
      }
      throw err;
    }

    return payload ?? {};
  }

  async list(filters: OrdersListFilters = {}): Promise<{ items: OrderListItem[]; total: number }> {
    const qs = new URLSearchParams();
    if (filters.status) {
      qs.set('status', filters.status);
    }
    if (filters.channel) {
      qs.set('channel', filters.channel);
    }
    if (
      filters.channel &&
      filters.channelInstanceId !== null &&
      filters.channelInstanceId !== undefined &&
      Number.isFinite(Number(filters.channelInstanceId))
    ) {
      qs.set('channelInstanceId', String(Math.trunc(Number(filters.channelInstanceId))));
    }
    if (filters.from) {
      qs.set('from', filters.from);
    }
    if (filters.to) {
      qs.set('to', filters.to);
    }
    if (filters.q !== undefined && filters.q !== null && String(filters.q).trim() !== '') {
      qs.set('q', String(filters.q).trim());
      const searchIn =
        filters.searchIn !== null && filters.searchIn !== undefined
          ? String(filters.searchIn).trim()
          : DEFAULT_ORDER_LIST_SEARCH_SCOPE;
      if (searchIn !== '') {
        qs.set('searchIn', searchIn);
      }
    }
    if (filters.sort) {
      qs.set('sort', filters.sort);
    }
    if (filters.order) {
      qs.set('order', filters.order);
    }
    const limit = filters.limit ?? DEFAULT_LIST_PAGE_SIZE;
    const offset = filters.offset ?? 0;
    qs.set('limit', String(limit));
    qs.set('offset', String(offset));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return (await this.request(`/${suffix}`)) as { items: OrderListItem[]; total: number };
  }

  async get(id: string): Promise<OrderDetails> {
    return (await this.request(`/${encodeURIComponent(id)}`)) as OrderDetails;
  }

  /** Lazy-loaded staff note only (no order lines). */
  async getNote(id: string): Promise<{ note: string | null }> {
    return (await this.request(`/${encodeURIComponent(id)}/note`)) as { note: string | null };
  }

  async updateNote(id: string, note: string): Promise<{ ok: true; hasStaffNote: boolean }> {
    return (await this.request(`/${encodeURIComponent(id)}/note`, {
      method: 'PUT',
      body: JSON.stringify({ note }),
    })) as { ok: true; hasStaffNote: boolean };
  }

  /** Samma anteckning på flera order (ersätter befintlig per order). */
  async updateNotesBatch(
    ids: string[],
    note: string,
  ): Promise<{
    ok: true;
    updated: number;
    updatedIds: string[];
    hasStaffNote: boolean;
  }> {
    return (await this.request('/batch/note', {
      method: 'PUT',
      body: JSON.stringify({ ids, note }),
    })) as {
      ok: true;
      updated: number;
      updatedIds: string[];
      hasStaffNote: boolean;
    };
  }

  async updateStatus(
    id: string,
    data: { status: OrderStatus; carrier?: string; trackingNumber?: string },
    options?: { forceUpdate?: boolean },
  ): Promise<OrderListItem> {
    const body: Record<string, unknown> = { ...data };
    if (options?.forceUpdate === true) {
      body.forceUpdate = true;
    }
    return (await this.request(`/${encodeURIComponent(id)}/status`, {
      method: 'PUT',
      body: JSON.stringify(body),
    })) as OrderListItem;
  }

  // Internal/testing: normalized ingest
  async ingest(data: any): Promise<{ ok: true; created: boolean; orderId: number | null }> {
    return (await this.request('/ingest', { method: 'POST', body: JSON.stringify(data) })) as any;
  }

  // Delete selected orders (batch). Body: { ids: string[] }.
  async deleteByIds(ids: string[]): Promise<{ ok: true; deletedCount: number }> {
    return (await this.request('/batch', {
      method: 'DELETE',
      body: JSON.stringify({ ids }),
    })) as any;
  }

  /** Trigger quick-sync (background). Returns { started: boolean, reason?: 'fresh'|'locked' }. */
  async sync(options?: { force?: boolean }): Promise<{ started: boolean; reason?: string }> {
    const body = options?.force === true ? JSON.stringify({ force: true }) : JSON.stringify({});
    return (await this.request('/sync', { method: 'POST', body })) as any;
  }

  /** Poll to know if sync is still running (for UI spinner). */
  async syncStatus(): Promise<{ busy: boolean }> {
    return (await this.request('/sync/status')) as any;
  }

  // Renumber order_number by placed_at (oldest = 1, newest = highest) across all channels
  async renumber(): Promise<{ ok: true; renumbered: number }> {
    return (await this.request('/renumber', { method: 'POST' })) as any;
  }

  // Batch update status for multiple orders. forceUpdate: skip CDON/Fyndiq 299+ tracking validation.
  async batchUpdateStatus(
    ids: string[],
    data: { status: OrderStatus; carrier?: string; trackingNumber?: string },
    options?: { forceUpdate?: boolean },
  ): Promise<{ ok: true; requested: number; updated: number; updatedIds: string[] }> {
    const body: Record<string, unknown> = { ids, ...data };
    if (options?.forceUpdate === true) {
      body.forceUpdate = true;
    }
    return (await this.request('/batch/status', {
      method: 'PUT',
      body: JSON.stringify(body),
    })) as any;
  }

  /** Download plocklista (pick list) PDF for selected order ids. channelLabels: optional map orderId -> display name (same as Channel column in list). */
  async downloadPlocklistaPdf(
    ids: string[],
    channelLabels?: Record<string, string>,
  ): Promise<Blob> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-CSRF-Token': await this.getCsrfToken(),
    };
    const response = await fetch(`${this.basePath}/plocklista/pdf`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ ids, channelLabels: channelLabels ?? undefined }),
    });
    if (!response.ok) {
      const text = await response.text();
      let message = 'Failed to download plocklista PDF';
      try {
        const payload = text ? JSON.parse(text) : null;
        if (payload?.error) {
          message = payload.error;
        }
      } catch {
        /* use default message if JSON parse fails */
      }
      const err: any = new Error(message);
      err.status = response.status;
      throw err;
    }
    const contentType = response.headers.get('Content-Type') || '';
    if (!contentType.toLowerCase().includes('application/pdf')) {
      const err: any = new Error('Server did not return a PDF (got ' + contentType + ')');
      err.status = response.status;
      throw err;
    }
    return response.blob();
  }

  /** Download receipt PDF: one page per order, same order as ids[]. */
  async downloadKvittoPdf(ids: string[], channelLabels?: Record<string, string>): Promise<Blob> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-CSRF-Token': await this.getCsrfToken(),
    };
    const response = await fetch(`${this.basePath}/kvitto/pdf`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ ids, channelLabels: channelLabels ?? undefined }),
    });
    if (!response.ok) {
      const text = await response.text();
      let message = 'Failed to download kvitto PDF';
      try {
        const payload = text ? JSON.parse(text) : null;
        if (payload?.error) {
          message = payload.error;
        }
      } catch {
        /* use default message if JSON parse fails */
      }
      const err: any = new Error(message);
      err.status = response.status;
      throw err;
    }
    const contentType = response.headers.get('Content-Type') || '';
    if (!contentType.toLowerCase().includes('application/pdf')) {
      const err: any = new Error('Server did not return a PDF (got ' + contentType + ')');
      err.status = response.status;
      throw err;
    }
    return response.blob();
  }

  /** Bokföringsunderlag (Excel). Same channelLabels semantics as plocklista/kvitto. */
  async downloadAccountingExcel(
    ids: string[],
    channelLabels?: Record<string, string>,
  ): Promise<Blob> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-CSRF-Token': await this.getCsrfToken(),
    };
    const response = await fetch(`${this.basePath}/accounting/xlsx`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ ids, channelLabels: channelLabels ?? undefined }),
    });
    if (!response.ok) {
      const text = await response.text();
      let message = 'Failed to download accounting export';
      try {
        const payload = text ? JSON.parse(text) : null;
        if (payload?.error) {
          message = payload.error;
        }
      } catch {
        /* use default message if JSON parse fails */
      }
      const err: any = new Error(message);
      err.status = response.status;
      throw err;
    }
    const contentType = response.headers.get('Content-Type') || '';
    const ct = contentType.toLowerCase();
    if (
      !ct.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') &&
      !ct.includes('application/octet-stream')
    ) {
      const err: any = new Error('Server did not return an Excel file (got ' + contentType + ')');
      err.status = response.status;
      throw err;
    }
    return response.blob();
  }

  /** Kolumn-id:n för anpassad orderexport (GET). */
  async getOrderExportFields(): Promise<{ orderFields: string[]; lineFields: string[] }> {
    return (await this.request('/export/fields')) as {
      orderFields: string[];
      lineFields: string[];
    };
  }

  /** Tvåblads-Excel (Order + Rader), filtrerat på placed_at. */
  async downloadOrdersExportExcel(body: {
    from: string;
    to: string;
    orderFields: string[];
    lineFields: string[];
  }): Promise<Blob> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-CSRF-Token': await this.getCsrfToken(),
    };
    const response = await fetch(`${this.basePath}/export/xlsx`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text();
      let message = 'Failed to download order export';
      try {
        const payload = text ? JSON.parse(text) : null;
        if (payload?.error) {
          message = payload.error;
        }
      } catch {
        /* use default message if JSON parse fails */
      }
      const err: any = new Error(message);
      err.status = response.status;
      throw err;
    }
    const contentType = response.headers.get('Content-Type') || '';
    const ct = contentType.toLowerCase();
    if (
      !ct.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') &&
      !ct.includes('application/octet-stream')
    ) {
      const err: any = new Error('Server did not return an Excel file (got ' + contentType + ')');
      err.status = response.status;
      throw err;
    }
    return response.blob();
  }
}

export const ordersApi = new OrdersApi();

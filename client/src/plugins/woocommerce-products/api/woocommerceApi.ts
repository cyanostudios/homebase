// client/src/plugins/woocommerce-products/api/woocommerceApi.ts
// WooCommerce API client with CSRF token support

import type { WooTestResult, WooExportResult } from '../types/woocommerce';

export type ApiFieldError = { field: string; message: string };

class WooCommerceApi {
  private csrfToken: string | null = null;

  private async getCsrfToken(): Promise<string> {
    if (this.csrfToken) {
      return this.csrfToken;
    }

    const response = await fetch('/api/csrf-token', {
      credentials: 'include',
    });
    const data = await response.json();
    this.csrfToken = data.csrfToken ?? null;
    if ((this.csrfToken ?? null) === null) {
      throw new Error('CSRF token not returned by server');
    }
    return this.csrfToken;
  }

  private async request(path: string, options: RequestInit = {}) {
    let response: Response;
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...((options.headers as Record<string, string>) || {}),
      };

      // Add CSRF token for mutations
      if (options.method && ['POST', 'PUT', 'DELETE'].includes(options.method)) {
        headers['X-CSRF-Token'] = await this.getCsrfToken();
      }

      response = await fetch(`/api/woocommerce-products${path}`, {
        ...options,
        headers,
        credentials: 'include',
      });
    } catch {
      const err: any = new Error('Network unreachable');
      err.status = 0;
      throw err;
    }

    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();

    if (!response.ok) {
      let payload: any = null;
      if (text && !contentType.includes('text/html') && !text.trimStart().startsWith('<')) {
        try {
          payload = JSON.parse(text);
        } catch {
          void 0;
        }
      }
      const err: any = new Error(
        response.status === 409 && payload?.errors?.[0]?.message
          ? payload.errors[0].message
          : payload?.error || response.statusText || 'Request failed',
      );
      err.status = response.status;
      if (payload?.errors) {
        err.errors = payload.errors as ApiFieldError[];
      }
      throw err;
    }

    if (!text) {
      return {};
    }
    if (contentType.includes('text/html') || text.trimStart().startsWith('<')) {
      const err: any = new Error(
        'Server returned HTML instead of JSON. The API may be unreachable (is the backend running?) or the route is missing.',
      );
      err.status = response.status;
      throw err;
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(
        `Invalid JSON response: ${text.slice(0, 100)}${text.length > 100 ? '…' : ''}`,
      );
    }
  }

  // ---- Woo settings ----
  // ---- Connection test ----
  async testConnection(data?: {
    storeUrl?: string;
    consumerKey?: string;
    consumerSecret?: string;
    useQueryAuth?: boolean;
    instanceId?: string;
  }): Promise<WooTestResult> {
    return this.request('/test', { method: 'POST', body: JSON.stringify(data || {}) });
  }

  // ---- Batch export ----
  async exportProducts(
    products: any[],
    opts?: { instanceIds?: string[] },
  ): Promise<WooExportResult> {
    const body: { products: any[]; instanceIds?: string[] } = { products };
    if (opts?.instanceIds?.length) {
      body.instanceIds = opts.instanceIds;
    }
    return this.request('/products/export', { method: 'POST', body: JSON.stringify(body) });
  }

  // ---- IMPORT (read-only) by SKU ----
  async importProductBySku(_sku: string): Promise<{
    ok: boolean;
    source: string;
    wooId: number;
    product: any;
  }> {
    throw new Error(
      'importProductBySku now requires instanceId; use importProductBySkuForInstance() instead.',
    );
  }

  async importProductBySkuForInstance(
    instanceId: string,
    sku: string,
  ): Promise<{
    ok: boolean;
    source: string;
    wooId: number;
    product: any;
  }> {
    return this.request(
      `/products/import?instanceId=${encodeURIComponent(instanceId)}&sku=${encodeURIComponent(sku)}`,
    );
  }

  // ---- Orders pull ----
  async pullOrders(data?: { perPage?: number; after?: string }): Promise<{
    ok: boolean;
    fetched: number;
    ingested: number;
    created: number;
    skippedExisting: number;
    results: Array<{ channelOrderId: string; created: boolean; orderId: number | null }>;
  }> {
    return this.request('/orders/pull', { method: 'POST', body: JSON.stringify(data || {}) });
  }

  // ---- Batch delete (Woo) ----
  // DELETE /api/woocommerce-products/batch
  // When instanceIds provided, send productIds so backend resolves external_id per instance.
  async deleteProducts(payload: {
    productIds?: string[];
    skus?: string[];
    externalIds?: number[];
    instanceIds?: string[];
  }): Promise<{
    ok: boolean;
    endpoint: string;
    deleted: number;
    items: Array<{
      externalId: number;
      status: 'deleted' | 'not_found' | 'error';
      message?: string;
    }>;
  }> {
    return this.request('/batch', {
      method: 'DELETE',
      body: JSON.stringify(payload),
    });
  }

  // ---- Instances (multi-store support) ----
  // GET /api/woocommerce-products/categories?instanceId=...&perPage=100&search=...
  async getCategories(params?: {
    instanceId?: string;
    perPage?: number;
    search?: string;
  }): Promise<{
    ok: boolean;
    endpoint?: string;
    items?: Array<{ id: number; name: string; slug?: string; parent?: number }>;
  }> {
    const q = new URLSearchParams();
    if (params?.instanceId) {
      q.set('instanceId', params.instanceId);
    }
    if ((params?.perPage ?? null) !== null) {
      q.set('perPage', String(params.perPage));
    }
    if (params?.search) {
      q.set('search', params.search);
    }
    return this.request(`/categories?${q.toString()}`);
  }

  async getInstances(): Promise<{
    ok: boolean;
    items: Array<{
      id: string;
      channel: string;
      instanceKey: string;
      market: string | null;
      label: string | null;
      credentials: {
        storeUrl: string;
        consumerKey: string;
        consumerSecret: string;
        useQueryAuth: boolean;
      } | null;
      createdAt: string | null;
      updatedAt: string | null;
    }>;
  }> {
    return this.request('/instances');
  }

  async createInstance(data: {
    instanceKey: string;
    label?: string;
    storeUrl: string;
    consumerKey: string;
    consumerSecret: string;
    useQueryAuth?: boolean;
  }): Promise<{
    ok: boolean;
    instance: {
      id: string;
      channel: string;
      instanceKey: string;
      market: string | null;
      label: string | null;
      credentials: {
        storeUrl: string;
        consumerKey: string;
        consumerSecret: string;
        useQueryAuth: boolean;
      } | null;
      createdAt: string | null;
      updatedAt: string | null;
    };
  }> {
    return this.request('/instances', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateInstance(
    id: string,
    data: {
      label?: string;
      storeUrl?: string;
      consumerKey?: string;
      consumerSecret?: string;
      useQueryAuth?: boolean;
    },
  ): Promise<{
    ok: boolean;
    instance: {
      id: string;
      channel: string;
      instanceKey: string;
      market: string | null;
      label: string | null;
      credentials: {
        storeUrl: string;
        consumerKey: string;
        consumerSecret: string;
        useQueryAuth: boolean;
      } | null;
      createdAt: string | null;
      updatedAt: string | null;
    };
  }> {
    return this.request(`/instances/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteInstance(id: string): Promise<{
    ok: boolean;
    deleted: { id: string };
  }> {
    return this.request(`/instances/${id}`, {
      method: 'DELETE',
    });
  }
}

export const woocommerceApi = new WooCommerceApi();

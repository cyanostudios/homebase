// client/src/plugins/fyndiq-products/api/fyndiqApi.ts

import type { FyndiqExportResult, FyndiqSettings, FyndiqTestResult } from '../types/fyndiq';

export type ApiFieldError = { field: string; message: string };

class FyndiqApi {
  private csrfToken: string | null = null;

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
      response = await fetch(`/api/fyndiq-products${path}`, {
        headers,
        credentials: 'include',
        ...options,
      });
    } catch {
      const err: any = new Error('Network unreachable');
      err.status = 0;
      throw err;
    }

    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();
    let payload: any = null;
    if (text) {
      if (contentType.includes('text/html') || text.trimStart().startsWith('<')) {
        const err: any = new Error(
          'Server returned HTML instead of JSON. The API may be unreachable (is the backend running?) or the route is missing.',
        );
        err.status = response.status;
        throw err;
      }
      try {
        payload = JSON.parse(text);
      } catch {
        throw new Error(`Invalid JSON response: ${text.slice(0, 100)}${text.length > 100 ? '…' : ''}`);
      }
    }

    if (!response.ok) {
      const err: any = new Error(payload?.error || payload?.message || response.statusText || 'Request failed');
      err.status = response.status;
      if (payload?.errors) err.errors = payload.errors as ApiFieldError[];
      throw err;
    }

    return payload ?? {};
  }

  async getSettings(): Promise<FyndiqSettings | null> {
    return this.request('/settings');
  }

  async putSettings(data: { apiKey?: string; apiSecret?: string }): Promise<FyndiqSettings> {
    return this.request('/settings', { method: 'PUT', body: JSON.stringify(data) });
  }

  async testConnection(data?: { apiKey?: string; apiSecret?: string }): Promise<FyndiqTestResult> {
    return this.request('/test', { method: 'POST', body: JSON.stringify(data || {}) });
  }

  async exportProducts(
    products: any[],
    opts?: { markets?: ('se' | 'dk' | 'fi')[] }
  ): Promise<FyndiqExportResult> {
    const body: { products: any[]; markets?: ('se' | 'dk' | 'fi')[] } = { products };
    if (opts?.markets?.length) body.markets = opts.markets;
    return this.request('/products/export', { method: 'POST', body: JSON.stringify(body) });
  }

  async batchDelete(
    productIds: string[],
    opts?: { markets?: ('se' | 'dk' | 'fi')[] }
  ): Promise<FyndiqExportResult> {
    const body: { productIds: string[]; markets?: ('se' | 'dk' | 'fi')[] } = { productIds };
    if (opts?.markets?.length) body.markets = opts.markets;
    return this.request('/batch', { method: 'DELETE', body: JSON.stringify(body) });
  }

  async pullOrders(data?: { perPage?: number; status?: string | string[] }): Promise<{
    ok: boolean;
    fetched: number;
    ingested: number;
    created: number;
    skippedExisting: number;
    results: Array<{ channelOrderId: string; created: boolean; orderId: number | null }>;
  }> {
    return this.request('/orders/pull', { method: 'POST', body: JSON.stringify(data || {}) });
  }
}

export const fyndiqApi = new FyndiqApi();


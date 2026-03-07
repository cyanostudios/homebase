// client/src/plugins/cdon-products/api/cdonApi.ts

import type { CdonExportResult, CdonSettings, CdonTestResult } from '../types/cdon';

export type ApiFieldError = { field: string; message: string };

class CdonApi {
  private csrfToken: string | null = null;

  private async getCsrfToken(): Promise<string> {
    if (this.csrfToken) {
      return this.csrfToken;
    }
    const response = await fetch('/api/csrf-token', { credentials: 'include' });
    const data = await response.json();
    const token = data?.csrfToken;
    if (typeof token !== 'string' || !token) {
      throw new Error('CSRF token missing from response');
    }
    this.csrfToken = token;
    return token;
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
      response = await fetch(`/api/cdon-products${path}`, {
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
        throw new Error(
          `Invalid JSON response: ${text.slice(0, 100)}${text.length > 100 ? '…' : ''}`,
        );
      }
    }

    if (!response.ok) {
      const err: any = new Error(
        payload?.error || payload?.message || response.statusText || 'Request failed',
      );
      err.status = response.status;
      if (payload?.errors) {
        err.errors = payload.errors as ApiFieldError[];
      }
      if (payload?.detail) {
        err.detail = payload.detail;
      }
      throw err;
    }

    return payload ?? {};
  }

  async getSettings(): Promise<CdonSettings | null> {
    return this.request('/settings');
  }

  async putSettings(data: { apiKey?: string; apiSecret?: string }): Promise<CdonSettings> {
    return this.request('/settings', { method: 'PUT', body: JSON.stringify(data) });
  }

  async testConnection(data?: { apiKey?: string; apiSecret?: string }): Promise<CdonTestResult> {
    return this.request('/test', { method: 'POST', body: JSON.stringify(data || {}) });
  }

  async exportProducts(
    products: any[],
    opts?: { markets?: ('se' | 'dk' | 'fi')[] },
  ): Promise<CdonExportResult> {
    const body: { products: any[]; markets?: ('se' | 'dk' | 'fi')[] } = { products };
    if (opts?.markets?.length) {
      body.markets = opts.markets;
    }
    return this.request('/products/export', { method: 'POST', body: JSON.stringify(body) });
  }

  async batchDelete(
    productIds: string[],
    opts?: { markets?: ('se' | 'dk' | 'fi')[] },
  ): Promise<CdonExportResult> {
    const body: { productIds: string[]; markets?: ('se' | 'dk' | 'fi')[] } = { productIds };
    if (opts?.markets?.length) {
      body.markets = opts.markets;
    }
    return this.request('/batch', { method: 'DELETE', body: JSON.stringify(body) });
  }

  async pullOrders(data?: { daysBack?: number }): Promise<{
    ok: boolean;
    fetched: number;
    ingested: number;
    created: number;
    skippedExisting: number;
    results: Array<{ channelOrderId: string; created: boolean; orderId: number | null }>;
  }> {
    return this.request('/orders/pull', { method: 'POST', body: JSON.stringify(data ?? {}) });
  }

  // ---- Articles (Merchants API v2) ----
  async bulkCreateArticles(payload: {
    articles: Record<string, unknown>[];
  }): Promise<{ success?: unknown[]; failed?: unknown[] }> {
    return this.request('/articles/bulk', { method: 'POST', body: JSON.stringify(payload) });
  }

  async bulkUpdateArticles(payload: {
    actions: Array<{ sku: string; action: string; body?: Record<string, unknown> }>;
  }): Promise<{ success?: unknown[]; failed?: unknown[] }> {
    return this.request('/articles/bulk', { method: 'PUT', body: JSON.stringify(payload) });
  }

  // ---- Status tracking (Merchants API v1) ----
  async statusesBatch(payload: { batch_ids: string[] }): Promise<{ batches?: unknown[] }> {
    return this.request('/statuses/batch', { method: 'POST', body: JSON.stringify(payload) });
  }

  async statusesSku(payload: { skus: string[] }): Promise<{ statuses?: unknown[] }> {
    return this.request('/statuses/sku', { method: 'POST', body: JSON.stringify(payload) });
  }

  /** Merchants API categories: pass market and language (e.g. SE, en-US). Returns category tree. */
  async getCategories(
    market: string,
    language: string,
  ): Promise<{ ok: boolean; items?: unknown[] }> {
    const path = `/categories?market=${encodeURIComponent(market)}&language=${encodeURIComponent(language)}`;
    return this.request(path);
  }
}

export const cdonApi = new CdonApi();

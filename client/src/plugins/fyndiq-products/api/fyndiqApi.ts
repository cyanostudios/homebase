// client/src/plugins/fyndiq-products/api/fyndiqApi.ts

import { getSharedCsrfToken } from '@/core/api/csrf';

import type { FyndiqExportResult, FyndiqSettings, FyndiqTestResult } from '../types/fyndiq';

export type ApiFieldError = { field: string; message: string };

class FyndiqApi {
  private async getCsrfToken(): Promise<string> {
    return getSharedCsrfToken();
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
    opts?: {
      markets?: ('se' | 'dk' | 'fi')[];
      diagnose?: boolean;
      mode?: 'update_only_strict';
      includePriceAndQuantity?: boolean;
    },
  ): Promise<FyndiqExportResult> {
    const body: {
      products: any[];
      markets?: ('se' | 'dk' | 'fi')[];
      diagnose?: boolean;
      mode?: 'update_only_strict';
      includePriceAndQuantity?: boolean;
    } = {
      products,
    };
    if (opts?.markets?.length) {
      body.markets = opts.markets;
    }
    if (opts?.diagnose) {
      body.diagnose = true;
    }
    if (opts?.mode) {
      body.mode = opts.mode;
    }
    if (opts?.includePriceAndQuantity === false) {
      body.includePriceAndQuantity = false;
    }
    return this.request('/products/export', { method: 'POST', body: JSON.stringify(body) });
  }

  async batchDelete(
    productIds: string[],
    opts?: { markets?: ('se' | 'dk' | 'fi')[] },
  ): Promise<FyndiqExportResult> {
    const body: { productIds: string[]; markets?: ('se' | 'dk' | 'fi')[] } = { productIds };
    if (opts?.markets?.length) {
      body.markets = opts.markets;
    }
    return this.request('/batch', { method: 'DELETE', body: JSON.stringify(body) });
  }

  async pullOrders(data?: {
    perPage?: number;
    status?: string | string[];
    renumber?: boolean;
  }): Promise<{
    ok: boolean;
    fetched: number;
    ingested: number;
    created: number;
    skippedExisting: number;
    results: Array<{ channelOrderId: string; created: boolean; orderId: number | null }>;
  }> {
    return this.request('/orders/pull', { method: 'POST', body: JSON.stringify(data || {}) });
  }

  // ---- Articles (Merchants API) ----
  async createArticle(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request('/articles', { method: 'POST', body: JSON.stringify(payload) });
  }

  async bulkCreateArticles(
    payloads: Record<string, unknown>[],
  ): Promise<{ description?: string; responses?: unknown[] }> {
    return this.request('/articles/bulk', { method: 'POST', body: JSON.stringify(payloads) });
  }

  async listArticles(params?: {
    limit?: number;
    page?: number;
    for_sale?: boolean;
  }): Promise<unknown[]> {
    const q = new URLSearchParams();
    if (params?.limit !== undefined && params?.limit !== null) {
      q.set('limit', String(params.limit));
    }
    if (params?.page !== undefined && params?.page !== null) {
      q.set('page', String(params.page));
    }
    if (params?.for_sale !== undefined) {
      q.set('for_sale', String(params.for_sale));
    }
    const path = '/articles' + (q.toString() ? `?${q.toString()}` : '');
    return this.request(path);
  }

  async getArticle(articleId: string): Promise<Record<string, unknown>> {
    return this.request(`/articles/${encodeURIComponent(articleId)}`);
  }

  async getArticleBySku(sku: string): Promise<Record<string, unknown>> {
    return this.request(`/articles/sku/${encodeURIComponent(sku)}`);
  }

  async updateArticle(
    articleId: string,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.request(`/articles/${encodeURIComponent(articleId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async updateArticlePrice(
    articleId: string,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.request(`/articles/${encodeURIComponent(articleId)}/price`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async updateArticleQuantity(
    articleId: string,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.request(`/articles/${encodeURIComponent(articleId)}/quantity`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async bulkUpdateArticles(
    items: Array<{ action: string; id: string; body: Record<string, unknown> }>,
  ): Promise<{ description?: string; responses?: unknown[] }> {
    return this.request('/articles/bulk', { method: 'PUT', body: JSON.stringify(items) });
  }

  async deleteArticle(articleId: string): Promise<void> {
    await this.request(`/articles/${encodeURIComponent(articleId)}`, { method: 'DELETE' });
  }

  async getCategories(
    market: string,
    language: string,
  ): Promise<{ ok: boolean; items?: unknown[] }> {
    const path = `/categories?market=${encodeURIComponent(market)}&language=${encodeURIComponent(language)}`;
    return this.request(path);
  }
}

export const fyndiqApi = new FyndiqApi();

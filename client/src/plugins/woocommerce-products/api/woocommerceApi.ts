// client/src/plugins/woocommerce-products/api/woocommerceApi.ts
// Copied from neutral TemplateApi pattern and specialized for Woo endpoints.

export type ApiFieldError = { field: string; message: string };

class WooApi {
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

  // ---- Woo settings ----
  getSettings() {
    return this.request('/settings');
  }

  putSettings(data: { storeUrl: string; consumerKey: string; consumerSecret: string; useQueryAuth?: boolean }) {
    return this.request('/settings', { method: 'PUT', body: JSON.stringify(data) });
  }

  // ---- Connection test ----
  testConnection(data?: { storeUrl?: string; consumerKey?: string; consumerSecret?: string; useQueryAuth?: boolean }) {
    return this.request('/test', { method: 'POST', body: JSON.stringify(data || {}) });
  }

  // ---- Batch export ----
  exportProducts(products: any[]) {
    return this.request('/products/export', { method: 'POST', body: JSON.stringify({ products }) });
  }
}

export const woocommerceApi = new WooApi('/api/woocommerce-products');

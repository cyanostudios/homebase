// Dedicated API client for Products (with 409-aware error handling and CSRF)

import type { Product } from '../types/products';

export type ApiFieldError = { field: string; message: string };
export type ProductImportMode = 'update-only' | 'create-only' | 'upsert';
export type ProductImportResult = {
  ok: true;
  mode: ProductImportMode;
  totalRows: number;
  created: number;
  updated: number;
  skippedMissingSku: Array<{ row: number }>;
  skippedInvalid: Array<{ row: number; sku: string; reason: string }>;
  conflicts: Array<{ row: number; sku: string; existingId: string }>;
  notFound: Array<{ row: number; sku: string }>;
  rows: Array<{ row: number; sku?: string; action: string; reason?: string; id?: string }>;
};

class ProductsApi {
  private csrfToken: string | null = null;

  private async getCsrfToken(): Promise<string> {
    if (this.csrfToken) return this.csrfToken;

    const response = await fetch('/api/csrf-token', {
      credentials: 'include'
    });
    const data = await response.json();
    this.csrfToken = data.csrfToken;
    return this.csrfToken;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    let response: Response;
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> || {}),
      };

      // Add CSRF token for mutations
      if (options.method && ['POST', 'PUT', 'DELETE'].includes(options.method)) {
        headers['X-CSRF-Token'] = await this.getCsrfToken();
      }

      response = await fetch(`/api${endpoint}`, {
        headers,
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
      try {
        payload = await response.json();
      } catch (_err) {
        void _err;
      }

      // Handle 404 specifically
      if (response.status === 404) {
        const err: any = new Error(payload?.error || payload?.message || 'Product not found');
        err.status = 404;
        err.error = payload?.error || 'Product not found';
        if (payload?.errors) {
          err.errors = payload.errors;
        }
        throw err;
      }

      // Handle 409 conflicts with field errors
      if (response.status === 409 && payload?.errors) {
        const err: any = new Error(
          payload.errors[0]?.message || 'A product with this information already exists',
        );
        err.status = 409;
        err.errors = payload.errors;
        throw err;
      }

      // Generic error handling
      const err: any = new Error(
        payload?.error || payload?.message || response.statusText || 'Request failed',
      );
      err.status = response.status;
      err.error = payload?.error || payload?.message;
      if (payload?.errors) {
        err.errors = payload.errors;
      }
      throw err;
    }

    // Vissa DELETE-endpoints returnerar tom body
    const text = await response.text();
    return text ? JSON.parse(text) : {};
  }

  // ---- CRUD ----

  async getProducts(): Promise<Product[]> {
    return this.request('/products');
  }

  async createProduct(data: any): Promise<Product> {
    return this.request('/products', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProduct(id: string, data: any): Promise<Product> {
    return this.request(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteProduct(id: string): Promise<void> {
    return this.request(`/products/${id}`, {
      method: 'DELETE',
    });
  }

  // ---- Bulk delete (Platform) ----
  // DELETE /api/products/batch
  // body: { ids: string[] }
  async deleteProductsBulk(ids: string[]): Promise<{ ok: true; requested: number; deleted: number; deletedIds: string[] }> {
    return this.request('/products/batch', {
      method: 'DELETE',
      body: JSON.stringify({ ids }),
    });
  }

  // ---- Import ----
  // POST /api/products/import (multipart/form-data)
  async importProducts(file: File, mode: ProductImportMode): Promise<ProductImportResult> {
    const csrf = await this.getCsrfToken();
    const form = new FormData();
    form.append('mode', mode);
    form.append('file', file);

    const response = await fetch('/api/products/import', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'X-CSRF-Token': csrf,
      },
      body: form,
    });

    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;

    if (!response.ok) {
      const err: any = new Error(payload?.error || payload?.message || response.statusText || 'Import failed');
      err.status = response.status;
      err.error = payload?.error || payload?.message;
      if (payload?.errors) err.errors = payload.errors;
      throw err;
    }

    return payload as ProductImportResult;
  }
}

export const productsApi = new ProductsApi();

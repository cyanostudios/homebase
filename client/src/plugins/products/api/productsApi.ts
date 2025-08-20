// Dedicated API client for Products (with 409-aware error handling)
class ProductsApi {
  private async request(endpoint: string, options: RequestInit = {}) {
    let response: Response;
    try {
      response = await fetch(`/api${endpoint}`, {
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

      // Build an error object and attach details
      const err: any = new Error(
        response.status === 409 && payload?.errors?.[0]?.message
          ? payload.errors[0].message
          : (payload?.error || response.statusText || 'Request failed')
      );
      err.status = response.status;
      if (payload?.errors) err.errors = payload.errors; // [{ field, message }]
      throw err;
    }

    // success
    // Some DELETE endpoints may return empty body; guard for that if needed.
    const text = await response.text();
    return text ? JSON.parse(text) : {};
  }

  async getProducts() {
    return this.request('/products');
  }

  async createProduct(data: any) {
    return this.request('/products', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateProduct(id: string, data: any) {
    return this.request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteProduct(id: string) {
    return this.request(`/products/${id}`, { method: 'DELETE' });
  }
}

export const productsApi = new ProductsApi();

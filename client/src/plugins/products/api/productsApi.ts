// Dedicated API client for Products (mirrors Contacts API shape)
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
      // Try to parse JSON error, otherwise fall back to status text
      let payload: any = null;
      try { payload = await response.json(); } catch {}
      const msg =
        (payload && payload.error) ||
        (response.status === 401 ? 'Unauthorized' : response.statusText) ||
        'Request failed';
      const err: any = new Error(msg);
      err.status = response.status;
      throw err;
    }

    return response.json();
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

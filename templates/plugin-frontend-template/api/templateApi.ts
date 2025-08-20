// templates/plugin-frontend-template/api/templateApi.ts
// TEMPLATE: Copy this file into your plugin and set the base path to your routeBase.
// Example usage after copy: export const woocommerceApi = new TemplateApi('/api/woocommerce');

export type ApiFieldError = { field: string; message: string };

export class TemplateApi {
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

  // CRUD helpers (rename as needed in your plugin)
  getItems() {
    return this.request('/');
  }

  createItem(data: any) {
    return this.request('/', { method: 'POST', body: JSON.stringify(data) });
  }

  updateItem(id: string, data: any) {
    return this.request(`/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  deleteItem(id: string) {
    return this.request(`/${id}`, { method: 'DELETE' });
  }
}

// Default export (left as a placeholder for the template; set to your route later)
export const templateApi = new TemplateApi('/api/rename-me'); // TODO: replace in your copied plugin

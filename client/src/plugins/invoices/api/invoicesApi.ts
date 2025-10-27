// client/src/plugins/invoices/api/invoicesApi.ts
export type ApiFieldError = { field: string; message: string };

export class InvoicesApi {
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

  // === CRUD ===
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

  // === Numbering ===
  getNextNumber() {
    return this.request('/number/next');
  }

  // === Shares ===
  createShare(invoiceId: string, validUntil: string) {
    return this.request('/shares', { method: 'POST', body: JSON.stringify({ invoiceId, validUntil }) });
  }

  getShares(invoiceId: string) {
    return this.request(`/${invoiceId}/shares`);
  }

  revokeShare(shareId: string) {
    return this.request(`/shares/${shareId}`, { method: 'DELETE' });
  }

  // === Public ===
  getPublicInvoice(token: string) {
    // Note: no credentials on public route
    return fetch(`${this.basePath}/public/${token}`).then(r => r.json());
  }

  // === PDF ===
  async downloadPdf(id: string): Promise<Blob> {
    const response = await fetch(`${this.basePath}/${id}/pdf`, {
      method: 'GET',
      credentials: 'include',
    });
    if (!response.ok) {
      const err: any = new Error('Failed to download PDF');
      err.status = response.status;
      throw err;
    }
    return await response.blob();
  }
}

// Default instance pointing at /api/invoices
export const invoicesApi = new InvoicesApi('/api/invoices');

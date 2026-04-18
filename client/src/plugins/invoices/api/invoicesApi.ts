// client/src/plugins/invoices/api/invoicesApi.ts
// Invoices API — mutating calls use apiFetch (CSRF when ENABLE_CSRF=true)
import { apiFetch } from '@/core/api/apiFetch';

export type ApiFieldError = { field: string; message: string };

export class InvoicesApi {
  constructor(private basePath: string) {}

  private async request(path: string, options: RequestInit = {}) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    let response: Response;
    try {
      response = await apiFetch(`${this.basePath}${path}`, {
        headers,
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
      } catch {
        // Ignore JSON parse errors - payload will remain null
      }

      const errorMessage =
        payload?.error || payload?.message || response.statusText || 'Request failed';
      const errorCode = payload?.code;
      const errorDetails = payload?.details;

      const err: any = new Error(
        response.status === 409 && payload?.errors?.[0]?.message
          ? payload.errors[0].message
          : errorMessage,
      );
      err.status = response.status;
      err.code = errorCode;
      err.details = errorDetails;
      if (payload?.errors) {
        err.errors = payload.errors as ApiFieldError[];
      }
      throw err;
    }

    const text = await response.text();
    return text ? JSON.parse(text) : {};
  }

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

  getNextNumber() {
    return this.request('/number/next');
  }

  createShare(invoiceId: string, validUntil: string) {
    return this.request('/shares', {
      method: 'POST',
      body: JSON.stringify({ invoiceId, validUntil }),
    });
  }

  getShares(invoiceId: string) {
    return this.request(`/${invoiceId}/shares`);
  }

  revokeShare(shareId: string) {
    return this.request(`/shares/${shareId}`, { method: 'DELETE' });
  }

  getPublicInvoice(token: string) {
    return fetch(`${this.basePath}/public/${token}`).then((r) => r.json());
  }

  async downloadPdf(id: string): Promise<Blob> {
    const response = await apiFetch(`${this.basePath}/${id}/pdf`, {
      method: 'GET',
    });
    if (!response.ok) {
      const err: any = new Error('Failed to download PDF');
      err.status = response.status;
      throw err;
    }
    return await response.blob();
  }
}

export const invoicesApi = new InvoicesApi('/api/invoices');

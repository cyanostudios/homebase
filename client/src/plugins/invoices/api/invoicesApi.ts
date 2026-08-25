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
      body: JSON.stringify({
        invoiceId: Number(invoiceId),
        // End of local day so "date only" values are not rejected as already past (UTC midnight).
        validUntil: /^\d{4}-\d{2}-\d{2}$/.test(validUntil) ? `${validUntil}T23:59:59` : validUntil,
      }),
    });
  }

  getShares(invoiceId: string) {
    return this.request(`/${invoiceId}/shares`);
  }

  revokeShare(shareId: string) {
    return this.request(`/shares/${shareId}`, { method: 'DELETE' });
  }

  getPublicInvoice(token: string) {
    return fetch(`${this.basePath}/public/${token}`).then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(data?.error || 'Failed to load invoice');
      }
      return data;
    });
  }

  async downloadPdf(id: string): Promise<Blob> {
    const response = await apiFetch(`${this.basePath}/${id}/pdf`, {
      method: 'GET',
    });
    if (!response.ok) {
      let errorMessage = 'Failed to download PDF';
      try {
        const text = await response.text();
        const match = text.match(/"error"\s*:\s*"([^"]+)"/);
        if (match) {
          errorMessage = match[1];
        }
      } catch {
        // Ignore parse errors when response body isn't JSON
      }
      const err: any = new Error(errorMessage);
      err.status = response.status;
      throw err;
    }
    const arrayBuffer = await response.arrayBuffer();
    return new Blob([arrayBuffer], { type: 'application/pdf' });
  }
}

export const invoicesApi = new InvoicesApi('/api/invoices');

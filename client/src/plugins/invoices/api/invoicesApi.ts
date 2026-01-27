// client/src/plugins/invoices/api/invoicesApi.ts
// Invoices API - V2 with CSRF protection
export type ApiFieldError = { field: string; message: string };

export class InvoicesApi {
  private csrfToken: string | null = null;

  constructor(private basePath: string) {}

  async getCsrfToken(): Promise<string> {
    if (this.csrfToken) {
      return this.csrfToken;
    }

    try {
      const response = await fetch('/api/csrf-token', {
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('CSRF token fetch failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
        });

        if (response.status === 401) {
          throw new Error('Session required. Please log in again.');
        } else if (response.status === 503) {
          throw new Error('CSRF protection not configured on server');
        } else {
          throw new Error(`Failed to get CSRF token: ${errorData.error || response.statusText}`);
        }
      }

      const data = await response.json();
      if (!data.csrfToken) {
        throw new Error('CSRF token not found in response');
      }

      this.csrfToken = data.csrfToken;
      return this.csrfToken;
    } catch (error: any) {
      console.error('CSRF token fetch failed:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to get CSRF token');
    }
  }

  private async request(path: string, options: RequestInit = {}) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    // Add CSRF token for mutations
    if (options.method && ['POST', 'PUT', 'DELETE'].includes(options.method)) {
      // CSRF temporarily disabled: headers["X-CSRF-Token"] = await this.getCsrfToken();
    }

    let response: Response;
    try {
      response = await fetch(`${this.basePath}${path}`, {
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
      } catch {}

      // Handle standardized error format from backend
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

  // === Public ===
  getPublicInvoice(token: string) {
    // Note: no credentials on public route
    return fetch(`${this.basePath}/public/${token}`).then((r) => r.json());
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

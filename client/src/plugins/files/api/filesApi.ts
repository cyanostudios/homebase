// client/src/plugins/files/api/filesApi.ts
// Files API - V2 with CSRF protection
export type ApiFieldError = { field: string; message: string };

export class FilesApi {
  private csrfToken: string | null = null;

  constructor(private basePath: string = '/api/files') {}

  async getCsrfToken(): Promise<string> {
    if (this.csrfToken) return this.csrfToken;
    
    try {
      const response = await fetch('/api/csrf-token', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('CSRF token fetch failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
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
      ...((options.headers as Record<string, string>) || {}),
    };

    // Add CSRF token for mutations (but not for multipart uploads - browser sets Content-Type)
    if (options.method && ['POST', 'PUT', 'DELETE'].includes(options.method)) {
      // For multipart uploads, don't set Content-Type header (browser needs to set boundary)
      if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
      }
      headers['X-CSRF-Token'] = await this.getCsrfToken();
    } else if (!options.method || options.method === 'GET') {
      // GET requests don't need CSRF token
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
      } catch {
        // ignore invalid JSON error payloads
      }

      // Handle standardized error format from backend
      const errorMessage = payload?.error || payload?.message || response.statusText || 'Request failed';
      const errorCode = payload?.code;
      const errorDetails = payload?.details;

      const err: any = new Error(
        response.status === 409 && payload?.errors?.[0]?.message
          ? payload.errors[0].message
          : errorMessage
      );
      err.status = response.status;
      err.code = errorCode;
      err.details = errorDetails;
      if (payload?.errors) err.errors = payload.errors as ApiFieldError[];
      throw err;
    }

    // may be [] or {}
    const text = await response.text();
    return text ? JSON.parse(text) : {};
  }

  // JSON CRUD
  getItems() {
    return this.request('/');
  }
  
  createItem(data: any) {
    return this.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  }
  
  updateItem(id: string, data: any) {
    return this.request(`/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  }
  
  deleteItem(id: string) {
    return this.request(`/${id}`, { method: 'DELETE' });
  }

  // ---- Bulk delete ----
  // DELETE /api/files/batch
  // body: { ids: string[] }
  async deleteFilesBulk(ids: string[]): Promise<{ ok: true; requested: number; deleted: number; deletedIds: string[] }> {
    return this.request('/batch', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
  }

  // MULTIPART upload (returns array of created items)
  async uploadFiles(files: File[]): Promise<any[]> {
    const fd = new FormData();
    for (const f of files) fd.append('files', f, f.name);
    return this.request('/upload', {
      method: 'POST',
      body: fd,
      // NOTE: let browser set the correct multipart boundary → no manual Content-Type
    });
  }
}

export const filesApi = new FilesApi('/api/files');

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

  private isCsrfMismatch(response: Response, payload: any): boolean {
    if (response.status !== 403) return false;
    const code = String(payload?.code || '');
    const message = String(payload?.error || payload?.message || '');
    return code === 'EBADCSRFTOKEN' || /invalid csrf token/i.test(message);
  }

  private async request(path: string, options: RequestInit = {}) {
    const method = String(options.method || 'GET').toUpperCase();
    const isMutation = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);
    let attemptedCsrfRefresh = false;

    const send = async () => {
      const headers: Record<string, string> = {
        ...((options.headers as Record<string, string>) || {}),
      };

      // Add CSRF token for mutations (but not for multipart uploads - browser sets Content-Type)
      if (isMutation) {
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
          ...options,
          headers,
          credentials: 'include',
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

        if (isMutation && !attemptedCsrfRefresh && this.isCsrfMismatch(response, payload)) {
          attemptedCsrfRefresh = true;
          this.csrfToken = null;
          return send();
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
    };

    return send();
  }

  // JSON CRUD
  getItems(folderPath?: string | null) {
    if (folderPath === undefined) return this.request('/');
    const q = '?folderPath=' + encodeURIComponent(folderPath === null ? '' : folderPath);
    return this.request('/' + q);
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
  // body: { ids?: string[], folderPaths?: string[] }
  async deleteFilesBulk(ids: string[] = [], folderPaths: string[] = []): Promise<{ ok: true; requested: number; deleted: number; deletedIds: string[] }> {
    return this.request('/batch', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, folderPaths }),
    });
  }

  // MULTIPART upload (returns array of created items)
  async uploadFiles(files: File[], folderPath?: string | null): Promise<any[]> {
    const fd = new FormData();
    for (const f of files) fd.append('files', f, f.name);
    if (folderPath !== undefined && folderPath !== null && folderPath !== '') {
      fd.append('folderPath', folderPath);
    }
    return this.request('/upload', {
      method: 'POST',
      body: fd,
      // NOTE: let browser set the correct multipart boundary → no manual Content-Type
    });
  }

  getFolders(): Promise<string[]> {
    return this.request('/folders');
  }

  createFolder(path: string): Promise<{ path: string; created: boolean }> {
    return this.request('/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
  }

  moveFile(id: string, folderPath: string | null): Promise<any> {
    return this.request(`/${encodeURIComponent(id)}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderPath }),
    });
  }

  // ---- Lists ----
  getLists(): Promise<Array<{ id: string; name: string; namespace: string; createdAt: string; updatedAt: string }>> {
    return this.request('/lists');
  }

  getListFiles(listId: string): Promise<any[]> {
    return this.request(`/lists/${encodeURIComponent(listId)}/files`);
  }

  createList(name: string): Promise<{ id: string; name: string; namespace: string; createdAt: string; updatedAt: string }> {
    return this.request('/lists', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  renameList(listId: string, name: string): Promise<{ id: string; name: string; namespace: string; createdAt: string; updatedAt: string }> {
    return this.request(`/lists/${encodeURIComponent(listId)}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    });
  }

  deleteList(listId: string): Promise<void> {
    return this.request(`/lists/${encodeURIComponent(listId)}`, { method: 'DELETE' });
  }

  addFilesToList(listId: string, fileIds: string[]): Promise<any> {
    return this.request(`/lists/${encodeURIComponent(listId)}/files`, {
      method: 'POST',
      body: JSON.stringify({ fileIds }),
    });
  }

  removeFileFromList(listId: string, fileId: string): Promise<void> {
    return this.request(`/lists/${encodeURIComponent(listId)}/files/${encodeURIComponent(fileId)}`, {
      method: 'DELETE',
    });
  }
}

export const filesApi = new FilesApi('/api/files');

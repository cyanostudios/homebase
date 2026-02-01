// client/src/plugins/files/api/filesApi.ts
export type ApiFieldError = { field: string; message: string };

export class FilesApi {
  constructor(private basePath: string = '/api/files') {}

  private async request(path: string, options: RequestInit = {}) {
    let response: Response;
    try {
      response = await fetch(`${this.basePath}${path}`, {
        headers: { ...(options.headers || {}) },
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

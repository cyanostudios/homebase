// client/src/plugins/files/api/filesApi.ts
// Files API — mutating calls use apiFetch (CSRF when ENABLE_CSRF=true)
import { apiFetch } from '@/core/api/apiFetch';

import type { FileAttachmentEntry, FileItem } from '../types/files';

export type ApiFieldError = { field: string; message: string };

export class FilesApi {
  constructor(private basePath: string = '/api/files') {}

  private async request(path: string, options: RequestInit = {}) {
    const headers: Record<string, string> = {
      ...((options.headers as Record<string, string>) || {}),
    };

    if (options.method && ['POST', 'PUT', 'DELETE'].includes(options.method)) {
      if (!(options.body instanceof FormData)) {
        const isDeleteWithoutBody =
          options.method === 'DELETE' && (options.body === undefined || options.body === null);
        if (!isDeleteWithoutBody && !headers['Content-Type']) {
          headers['Content-Type'] = 'application/json';
        }
      }
    }

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
        // Response is not JSON, use default error message
      }

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
  async deleteFilesBulk(
    ids: string[],
  ): Promise<{ ok: true; requested: number; deleted: number; deletedIds: string[] }> {
    return this.request('/batch', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
  }

  // MULTIPART upload (returns array of created items)
  async uploadFiles(files: File[]): Promise<FileItem[]> {
    const fd = new FormData();
    for (const f of files) {
      fd.append('files', f, f.name);
    }
    return this.request('/upload', {
      method: 'POST',
      body: fd,
      // NOTE: let browser set the correct multipart boundary → no manual Content-Type
    });
  }

  /**
   * Authenticated URL that streams file bytes via storage abstraction.
   * Use `inline: true` for “open in tab” (Content-Disposition: inline); default is attachment download.
   */
  getFileDownloadUrl(fileId: string, options?: { inline?: boolean }): string {
    const path = `${this.basePath}/${encodeURIComponent(fileId)}/download`;
    if (options?.inline) {
      return `${path}?inline=1`;
    }
    return path;
  }

  listAttachments(pluginName: string, entityId: string): Promise<FileAttachmentEntry[]> {
    const q = new URLSearchParams({
      plugin: pluginName,
      entityId: String(entityId),
    });
    return this.request(`/attachments?${q.toString()}`);
  }

  createAttachment(payload: { pluginName: string; entityId: string; fileId: string }): Promise<{
    attachmentId: string;
    fileId: string;
    pluginName: string;
    entityId: string;
    file: Pick<
      FileItem,
      'id' | 'name' | 'size' | 'mimeType' | 'url' | 'storageProvider' | 'externalFileId'
    >;
  }> {
    return this.request('/attachments', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  deleteAttachment(attachmentId: string): Promise<{ ok: true; id: string }> {
    return this.request(`/attachments/${encodeURIComponent(attachmentId)}`, {
      method: 'DELETE',
    });
  }
}

export const filesApi = new FilesApi('/api/files');

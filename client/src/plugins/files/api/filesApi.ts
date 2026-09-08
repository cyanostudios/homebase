// client/src/plugins/files/api/filesApi.ts
import { apiFetch } from '@/core/api/apiFetch';
import { createApiClient } from '@/core/api/createApiClient';

import type { FileAttachmentEntry, FileItem } from '../types/files';

export type ApiFieldError = { field: string; message: string };

export class FilesApi {
  private request = createApiClient('/files');

  private async uploadRequest(path: string, body: FormData): Promise<any> {
    let response: Response;
    try {
      response = await apiFetch(`/api/files${path}`, { method: 'POST', body });
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
        /* ignore */
      }
      const errorMessage =
        payload?.error || payload?.message || response.statusText || 'Request failed';
      const err: any = new Error(
        response.status === 409 && payload?.errors?.[0]?.message
          ? payload.errors[0].message
          : errorMessage,
      );
      err.status = response.status;
      err.code = payload?.code;
      err.details = payload?.details;
      if (payload?.errors) {
        err.errors = payload.errors as ApiFieldError[];
      }
      throw err;
    }
    const text = await response.text();
    return text ? JSON.parse(text) : {};
  }

  getItems() {
    return this.request('');
  }

  createItem(data: any) {
    return this.request('', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  updateItem(id: string, data: any) {
    return this.request(`/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  deleteItem(id: string) {
    return this.request(`/${id}`, { method: 'DELETE' });
  }

  async uploadFiles(files: File[]): Promise<FileItem[]> {
    const fd = new FormData();
    for (const f of files) {
      fd.append('files', f, f.name);
    }
    return this.uploadRequest('/upload', fd);
  }

  getFileDownloadUrl(fileId: string, options?: { inline?: boolean }): string {
    const path = `/api/files/${encodeURIComponent(fileId)}/download`;
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

export const filesApi = new FilesApi();

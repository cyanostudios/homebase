// Inspection API
class InspectionApi {
  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    const response = await fetch(`/api/inspection${endpoint}`, {
      headers,
      credentials: 'include',
      ...options,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      const err: any = new Error(error.error || error.message || 'Request failed');
      err.status = response.status;
      err.code = error.code;
      throw err;
    }

    if (response.status === 204) return;
    return response.json();
  }

  async getProjects() {
    return this.request('/projects');
  }

  async getProject(id: string) {
    return this.request(`/projects/${id}`);
  }

  async createProject(data: { name?: string; description?: string; adminNotes?: string }) {
    return this.request('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProject(
    id: string,
    data: { name?: string; description?: string; adminNotes?: string }
  ) {
    return this.request(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteProject(id: string) {
    return this.request(`/projects/${id}`, { method: 'DELETE' });
  }

  async addFiles(projectId: string, fileIds: string[]) {
    return this.request(`/projects/${projectId}/files`, {
      method: 'POST',
      body: JSON.stringify({ fileIds }),
    });
  }

  async setFiles(projectId: string, fileIds: string[]) {
    return this.request(`/projects/${projectId}/files`, {
      method: 'PUT',
      body: JSON.stringify({ fileIds }),
    });
  }

  async removeFile(projectId: string, fileId: string) {
    return this.request(`/projects/${projectId}/files/${fileId}`, { method: 'DELETE' });
  }

  async addFileList(projectId: string, listId: string) {
    return this.request(`/projects/${projectId}/file-lists`, {
      method: 'POST',
      body: JSON.stringify({ listId }),
    });
  }

  async removeFileList(projectId: string, fileListId: string) {
    return this.request(`/projects/${projectId}/file-lists/${fileListId}`, { method: 'DELETE' });
  }

  async send(projectId: string, data: {
    recipients: string[];
    includeDescription?: boolean;
    includeAdminNotes?: boolean;
    fileIds?: string[];
    listIds?: string[];
  }) {
    return this.request(`/projects/${projectId}/send`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getSendHistory(projectId: string): Promise<SendHistoryEntry[]> {
    return this.request(`/projects/${projectId}/send-history`);
  }

  /** Bulk delete inspection projects only. Uses POST /api/inspection/projects/batch-delete – no other plugins (e.g. orders) are involved. */
  async deleteInspectionProjectsBulk(ids: string[]): Promise<{ ok: true; deletedCount: number; deletedIds: string[] }> {
    return this.request('/projects/batch-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
  }
}

export interface SendHistoryEntry {
  id: string;
  to: string;
  subject: string;
  sentAt: string;
  referenceId: string | null;
  createdAt: string;
  metadata?: { fileCount?: number } | null;
}

export const inspectionApi = new InspectionApi();

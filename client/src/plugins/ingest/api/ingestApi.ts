// client/src/plugins/ingest/api/ingestApi.ts — CSRF on mutations (guide §9 / §12)
import type { IngestRun, IngestSource } from '../types/ingest';

class IngestApi {
  private csrfToken: string | null = null;

  private async getCsrfToken(): Promise<string> {
    if (this.csrfToken) {
      return this.csrfToken;
    }
    const response = await fetch('/api/csrf-token', { credentials: 'include' });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `CSRF token failed: ${response.statusText}`);
    }
    const data = await response.json();
    if (!data.csrfToken) {
      throw new Error('CSRF token missing in response');
    }
    this.csrfToken = data.csrfToken;
    return this.csrfToken;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const headers: Record<string, string> = {
      ...((options.headers as Record<string, string>) || {}),
    };

    if (options.method && ['POST', 'PUT', 'DELETE'].includes(options.method)) {
      headers['Content-Type'] = 'application/json';
      headers['X-CSRF-Token'] = await this.getCsrfToken();
    }

    const response = await fetch(`/api${endpoint}`, {
      headers,
      credentials: 'include',
      ...options,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      const errorMessage = error.error || error.message || 'Request failed';
      const err: Error & { status?: number; code?: string; details?: unknown } = new Error(
        errorMessage,
      );
      err.status = response.status;
      err.code = error.code;
      err.details = error.details;
      throw err;
    }

    if (response.status === 204) {
      return null;
    }

    return response.json();
  }

  async getSources(): Promise<IngestSource[]> {
    return this.request('/ingest');
  }

  async getSource(id: string): Promise<IngestSource> {
    return this.request(`/ingest/${id}`);
  }

  async createSource(data: Record<string, unknown>): Promise<IngestSource> {
    return this.request('/ingest', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSource(id: string, data: Record<string, unknown>): Promise<IngestSource> {
    return this.request(`/ingest/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteSource(id: string): Promise<void> {
    await this.request(`/ingest/${id}`, { method: 'DELETE' });
  }

  async getRuns(sourceId: string, limit?: number): Promise<IngestRun[]> {
    const q = limit !== undefined && limit !== null ? `?limit=${limit}` : '';
    return this.request(`/ingest/${sourceId}/runs${q}`);
  }

  async runImport(sourceId: string): Promise<{ run: IngestRun; source: IngestSource }> {
    return this.request(`/ingest/${sourceId}/run`, { method: 'POST' });
  }
}

export const ingestApi = new IngestApi();

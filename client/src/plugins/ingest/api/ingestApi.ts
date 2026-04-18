// client/src/plugins/ingest/api/ingestApi.ts — CSRF on mutations via apiFetch
import { apiFetch } from '@/core/api/apiFetch';

import type { IngestRun, IngestSource } from '../types/ingest';

class IngestApi {
  private async request(endpoint: string, options: RequestInit = {}) {
    const headers: Record<string, string> = {
      ...((options.headers as Record<string, string>) || {}),
    };

    if (options.method && ['POST', 'PUT', 'DELETE'].includes(options.method)) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await apiFetch(`/api${endpoint}`, {
      headers,
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

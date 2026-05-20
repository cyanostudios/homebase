// client/src/plugins/ingest/api/ingestApi.ts — CSRF on mutations via apiFetch
import { createApiClient } from '@/core/api/createApiClient';

import type { IngestRun, IngestSource } from '../types/ingest';

class IngestApi {
  private request = createApiClient('/ingest', {
    jsonOnMutationsOnly: true,
    emptyBodyAsNull: true,
  });

  async getSources(): Promise<IngestSource[]> {
    return this.request('') as Promise<IngestSource[]>;
  }

  async getSource(id: string): Promise<IngestSource> {
    return this.request(`/${id}`) as Promise<IngestSource>;
  }

  async createSource(data: Record<string, unknown>): Promise<IngestSource> {
    return this.request('', {
      method: 'POST',
      body: JSON.stringify(data),
    }) as Promise<IngestSource>;
  }

  async updateSource(id: string, data: Record<string, unknown>): Promise<IngestSource> {
    return this.request(`/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }) as Promise<IngestSource>;
  }

  async deleteSource(id: string): Promise<void> {
    await this.request(`/${id}`, { method: 'DELETE' });
  }

  async getRuns(sourceId: string, limit?: number): Promise<IngestRun[]> {
    const q = limit !== undefined && limit !== null ? `?limit=${limit}` : '';
    return this.request(`/${sourceId}/runs${q}`) as Promise<IngestRun[]>;
  }

  async runImport(sourceId: string): Promise<{ run: IngestRun; source: IngestSource }> {
    return this.request(`/${sourceId}/run`, { method: 'POST' }) as Promise<{
      run: IngestRun;
      source: IngestSource;
    }>;
  }
}

export const ingestApi = new IngestApi();

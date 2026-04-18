import { apiFetch } from '@/core/api/apiFetch';

import type { Cup } from '../types/cups';

function decodeHtmlEntities(value: string): string {
  if (typeof document === 'undefined') {
    return value;
  }
  const textarea = document.createElement('textarea');
  textarea.innerHTML = value;
  return textarea.value;
}

function optionalString(v: unknown): string | null {
  if (v === null || v === undefined) {
    return null;
  }
  return decodeHtmlEntities(String(v));
}

function optionalNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') {
    return null;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toBoolean(v: unknown, fallback = true): boolean {
  if (v === null || v === undefined) {
    return fallback;
  }
  if (v === false || v === 'false' || v === 0 || v === '0') {
    return false;
  }
  return true;
}

function rowToCup(row: Record<string, unknown>): Cup {
  return {
    id: String(row.id),
    name: decodeHtmlEntities(String(row.name ?? '')),
    organizer: optionalString(row.organizer),
    location: optionalString(row.location),
    start_date: optionalString(row.start_date),
    end_date: optionalString(row.end_date),
    categories: optionalString(row.categories),
    visible: toBoolean(row.visible, true),
    featured: toBoolean(row.featured, false),
    sanctioned: toBoolean(row.sanctioned, true),
    team_count: optionalNumber(row.team_count),
    match_format: optionalString(row.match_format),
    description: optionalString(row.description),
    registration_url: optionalString(row.registration_url),
    source_url: optionalString(row.source_url),
    source_type: optionalString(row.source_type),
    ingest_source_id: optionalString(row.ingest_source_id),
    ingest_run_id: optionalString(row.ingest_run_id),
    external_id: optionalString(row.external_id),
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  };
}

class CupsApi {
  private async request(endpoint: string, options: RequestInit = {}) {
    const response = await apiFetch(`/api${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...options,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err?.error || err?.message || 'Request failed');
    }
    return response.json();
  }

  async getCups(): Promise<Cup[]> {
    const rows = await this.request('/cups');
    return (rows || []).map((row: Record<string, unknown>) => rowToCup(row));
  }

  async createCup(data: Partial<Cup> & { name: string }): Promise<Cup> {
    const row = await this.request('/cups', { method: 'POST', body: JSON.stringify(data) });
    return rowToCup(row);
  }

  async updateCup(id: string, data: Partial<Cup> & { name: string }): Promise<Cup> {
    const row = await this.request(`/cups/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    return rowToCup(row);
  }

  async deleteCup(id: string): Promise<void> {
    await this.request(`/cups/${id}`, { method: 'DELETE' });
  }

  async importFromIngestSource(sourceId: string): Promise<{
    sourceId: string;
    fetched: boolean;
    parsed: number;
    created: number;
    updated: number;
    skipped: number;
    errors: string[];
  }> {
    return this.request(`/cups/import-from-ingest/${sourceId}`, { method: 'POST' });
  }
}

export const cupsApi = new CupsApi();

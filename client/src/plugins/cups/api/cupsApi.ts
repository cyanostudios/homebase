import { Cup, CupSource } from '../types/cup';

function rowToCup(row: Record<string, unknown>): Cup {
  return {
    id: String(row.id),
    name: String(row.name ?? 'Unnamed Cup'),
    organizer: (row.organizer as string) ?? null,
    region: (row.region as string) ?? null,
    location: (row.location as string) ?? null,
    sport_type: String(row.sport_type ?? 'football'),
    start_date: (row.start_date as string) ?? null,
    end_date: (row.end_date as string) ?? null,
    age_groups: (row.age_groups as string) ?? null,
    registration_url: (row.registration_url as string) ?? null,
    source_url: (row.source_url as string) ?? null,
    source_id: row.source_id !== null ? String(row.source_id) : null,
    raw_snippet: (row.raw_snippet as string) ?? null,
    scraped_at: (row.scraped_at as string) ?? null,
    visible: row.visible !== false,
    sanctioned: row.sanctioned === true,
    created_at: (row.created_at as string) ?? '',
    updated_at: (row.updated_at as string) ?? '',
  };
}

function rowToSource(row: Record<string, unknown>): CupSource {
  return {
    id: String(row.id),
    type: (row.type as 'url' | 'file') ?? 'url',
    url: (row.url as string) ?? null,
    filename: (row.filename as string) ?? null,
    label: (row.label as string) ?? null,
    enabled: Boolean(row.enabled),
    last_scraped_at: (row.last_scraped_at as string) ?? null,
    last_result: (row.last_result as string) ?? null,
    created_at: (row.created_at as string) ?? '',
    updated_at: (row.updated_at as string) ?? null,
  };
}

class CupsApi {
  private async request(endpoint: string, options: RequestInit = {}) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    const response = await fetch(`/api${endpoint}`, {
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

    return response.json();
  }

  // ─── CUPS ───────────────────────────────────────────────────────────────────

  async getCups(): Promise<Cup[]> {
    const rows = await this.request('/cups');
    return (rows || []).map((row: Record<string, unknown>) => rowToCup(row));
  }

  async getCup(id: string): Promise<Cup> {
    const row = await this.request(`/cups/${id}`);
    return rowToCup(row);
  }

  async createCup(data: Partial<Cup>): Promise<Cup> {
    const row = await this.request('/cups', { method: 'POST', body: JSON.stringify(data) });
    return rowToCup(row);
  }

  async updateCup(id: string, data: Partial<Cup>): Promise<Cup> {
    const row = await this.request(`/cups/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    return rowToCup(row);
  }

  async deleteCup(id: string): Promise<void> {
    await this.request(`/cups/${id}`, { method: 'DELETE' });
  }

  async bulkDeleteCups(ids: string[]): Promise<{ deleted: number }> {
    return this.request('/cups/batch', { method: 'DELETE', body: JSON.stringify({ ids }) });
  }

  // ─── SOURCES ─────────────────────────────────────────────────────────────────

  async getSources(): Promise<CupSource[]> {
    const rows = await this.request('/cups/settings/sources');
    return (rows || []).map((row: Record<string, unknown>) => rowToSource(row));
  }

  async createSource(data: {
    type: 'url' | 'file';
    url?: string;
    label?: string;
  }): Promise<CupSource> {
    const row = await this.request('/cups/settings/sources', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return rowToSource(row);
  }

  async updateSource(id: string, data: Partial<CupSource>): Promise<CupSource> {
    const row = await this.request(`/cups/settings/sources/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return rowToSource(row);
  }

  async deleteSource(id: string): Promise<void> {
    await this.request(`/cups/settings/sources/${id}`, { method: 'DELETE' });
  }

  async uploadSourceFile(id: string, file: File): Promise<CupSource> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`/api/cups/settings/sources/${id}/upload-file`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || 'Upload failed');
    }
    const row = await response.json();
    return rowToSource(row);
  }

  // ─── SCRAPE ─────────────────────────────────────────────────────────────────

  async scrapeSource(id: string): Promise<{ ok: boolean; found: number; inserted: number; skipped: number }> {
    return this.request(`/cups/settings/sources/${id}/scrape`, { method: 'POST' });
  }

  async scrapeFile(
    id: string,
    file: File,
  ): Promise<{ ok: boolean; found: number; inserted: number; skipped: number }> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`/api/cups/settings/sources/${id}/scrape-file`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || 'Scrape failed');
    }
    return response.json();
  }
}

export const cupsApi = new CupsApi();

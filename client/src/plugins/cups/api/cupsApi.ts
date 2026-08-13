import { apiFetch } from '@/core/api/apiFetch';

import type { Cup } from '../types/cups';
import type { CupPageviewStats } from '../types/pageviewStats';

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

function messageFromApiErrorBody(body: Record<string, unknown> | null, fallback: string): string {
  if (!body) {
    return fallback;
  }
  const primary =
    (typeof body.error === 'string' && body.error) ||
    (typeof body.message === 'string' && body.message) ||
    '';
  const details = body.details;
  let detailStr = '';
  if (Array.isArray(details)) {
    detailStr = details
      .map((d: unknown) => {
        if (
          d &&
          typeof d === 'object' &&
          'msg' in d &&
          typeof (d as { msg: string }).msg === 'string'
        ) {
          return (d as { msg: string }).msg;
        }
        return typeof d === 'string' ? d : JSON.stringify(d);
      })
      .filter(Boolean)
      .join('; ');
  }
  if (primary && detailStr) {
    return `${primary}: ${detailStr}`;
  }
  if (primary) {
    return primary;
  }
  if (detailStr) {
    return detailStr;
  }
  return fallback;
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
    featured_image_url: optionalString(row.featured_image_url),
    source_url: optionalString(row.source_url),
    source_type: optionalString(row.source_type),
    ingest_source_id: optionalString(row.ingest_source_id),
    ingest_run_id: optionalString(row.ingest_run_id),
    external_id: optionalString(row.external_id),
    last_seen_at: optionalString(row.last_seen_at),
    deleted_at: optionalString(row.deleted_at),
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
    ratings_count: optionalNumber(row.ratings_count) ?? 0,
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
      const text = await response.text();
      let parsed: Record<string, unknown> | null = null;
      if (text) {
        try {
          parsed = JSON.parse(text) as Record<string, unknown>;
        } catch {
          parsed = null;
        }
      }
      const fallback = text.trim().slice(0, 280) || response.statusText || 'Request failed';
      throw new Error(messageFromApiErrorBody(parsed, fallback));
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

  async restoreCup(id: string): Promise<Cup> {
    const row = await this.request(`/cups/${id}/restore`, { method: 'POST' });
    return rowToCup(row);
  }

  async importFromIngestSource(sourceId: string): Promise<{
    sourceId: string;
    fetched: boolean;
    parsed: number;
    created: number;
    updated: number;
    skipped: number;
    softDeleted: number;
    restored: number;
    hardDeleted: number;
    errors: string[];
  }> {
    return this.request(`/cups/import-from-ingest/${sourceId}`, { method: 'POST' });
  }

  async getPageviewStats(days = 30): Promise<CupPageviewStats> {
    const q = new URLSearchParams({ days: String(days) });
    const raw = (await this.request(`/cups/stats/pageviews?${q.toString()}`)) as Record<
      string,
      unknown
    >;
    const totalsRaw = (raw.totals && typeof raw.totals === 'object' ? raw.totals : {}) as Record<
      string,
      unknown
    >;
    return {
      days: Number(raw.days) || days,
      totals: {
        views: Number(totalsRaw.views) || 0,
        cups: Number(totalsRaw.cups) || 0,
        districts: Number(totalsRaw.districts) || 0,
        sources: Number(totalsRaw.sources) || 0,
      },
      series: Array.isArray(raw.series)
        ? raw.series.map((row: Record<string, unknown>) => ({
            day: String(row.day ?? '').slice(0, 10),
            views: Number(row.views) || 0,
          }))
        : [],
      topCups: Array.isArray(raw.topCups)
        ? raw.topCups.map((row: Record<string, unknown>) => ({
            cup_id: Number(row.cup_id) || 0,
            name: String(row.name ?? ''),
            district:
              row.district != null && String(row.district).trim() !== ''
                ? String(row.district)
                : null,
            start_date:
              row.start_date != null && String(row.start_date).trim() !== ''
                ? String(row.start_date)
                : null,
            end_date:
              row.end_date != null && String(row.end_date).trim() !== ''
                ? String(row.end_date)
                : null,
            views: Number(row.views) || 0,
          }))
        : [],
      topDistricts: Array.isArray(raw.topDistricts)
        ? raw.topDistricts.map((row: Record<string, unknown>) => ({
            district_slug: String(row.district_slug ?? ''),
            views: Number(row.views) || 0,
          }))
        : [],
      sources: Array.isArray(raw.sources)
        ? raw.sources.map((row: Record<string, unknown>) => ({
            bucket: String(row.bucket ?? ''),
            referrer_domain: String(row.referrer_domain ?? ''),
            views: Number(row.views) || 0,
          }))
        : [],
    };
  }

  async getFallbackImages(): Promise<string[]> {
    const raw = (await this.request('/cups/site-config/fallback-images')) as {
      urls?: unknown;
    };
    return Array.isArray(raw.urls)
      ? raw.urls.map((u) => String(u || '').trim()).filter(Boolean)
      : [];
  }

  async setFallbackImages(urls: string[]): Promise<string[]> {
    const raw = (await this.request('/cups/site-config/fallback-images', {
      method: 'PUT',
      body: JSON.stringify({ urls }),
    })) as { urls?: unknown };
    return Array.isArray(raw.urls)
      ? raw.urls.map((u) => String(u || '').trim()).filter(Boolean)
      : [];
  }
}

export const cupsApi = new CupsApi();

import { Match, MatchMention } from '../types/match';

function parseMentions(row: Record<string, unknown>): MatchMention[] {
  let raw = row.mentions;
  if (raw === null || raw === undefined) {
    return [];
  }
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw) as MatchMention[];
    } catch {
      return [];
    }
  }
  return Array.isArray(raw) ? (raw as MatchMention[]) : [];
}

function rowToMatch(row: Record<string, unknown>): Match {
  return {
    id: String(row.id),
    home_team: (row.home_team as string) ?? '',
    away_team: (row.away_team as string) ?? '',
    location: (row.location as string) ?? null,
    start_time: (row.start_time as string) ?? '',
    sport_type: (row.sport_type as Match['sport_type']) ?? 'football',
    format: (row.format as string) ?? '',
    total_minutes:
      row.total_minutes !== null && row.total_minutes !== undefined
        ? Number(row.total_minutes)
        : null,
    contact_id:
      row.contact_id !== null && row.contact_id !== undefined ? String(row.contact_id) : null,
    mentions: parseMentions(row),
    created_at: (row.created_at as string) ?? '',
    updated_at: (row.updated_at as string) ?? '',
  };
}

class MatchesApi {
  private csrfToken: string | null = null;

  async getCsrfToken(): Promise<string> {
    if (this.csrfToken) {
      return this.csrfToken;
    }
    try {
      const response = await fetch('/api/csrf-token', { credentials: 'include' });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || response.statusText);
      }
      const data = await response.json();
      if (!data.csrfToken) {
        throw new Error('CSRF token not found');
      }
      this.csrfToken = data.csrfToken;
      return this.csrfToken;
    } catch (error: any) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to get CSRF token');
    }
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };
    if (options.method && ['POST', 'PUT', 'DELETE'].includes(options.method)) {
      // CSRF temporarily disabled
    }

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
      err.details = error.details;
      throw err;
    }

    return response.json();
  }

  async getMatches(): Promise<Match[]> {
    const rows = await this.request('/matches');
    return (rows || []).map((row: Record<string, unknown>) => rowToMatch(row));
  }

  async getMatch(id: string): Promise<Match> {
    const row = await this.request(`/matches/${id}`);
    return rowToMatch(row);
  }

  async createMatch(data: {
    home_team: string;
    away_team: string;
    location?: string | null;
    start_time: string;
    sport_type: string;
    format: string;
    total_minutes?: number | null;
    contact_id?: string | null;
    mentions?: MatchMention[];
  }): Promise<Match> {
    const body = {
      home_team: data.home_team,
      away_team: data.away_team,
      location: data.location ?? null,
      start_time: data.start_time,
      sport_type: data.sport_type,
      format: data.format,
      total_minutes: data.total_minutes ?? null,
      contact_id: data.contact_id ?? null,
      mentions: data.mentions ?? [],
    };
    const row = await this.request('/matches', { method: 'POST', body: JSON.stringify(body) });
    return rowToMatch(row);
  }

  async updateMatch(id: string, data: Partial<Match>): Promise<Match> {
    const body = {
      home_team: data.home_team,
      away_team: data.away_team,
      location: data.location ?? null,
      start_time: data.start_time,
      sport_type: data.sport_type,
      format: data.format,
      total_minutes: data.total_minutes ?? null,
      contact_id: data.contact_id ?? null,
      mentions: data.mentions ?? [],
    };
    const row = await this.request(`/matches/${id}`, { method: 'PUT', body: JSON.stringify(body) });
    return rowToMatch(row);
  }

  async deleteMatch(id: string): Promise<void> {
    await this.request(`/matches/${id}`, { method: 'DELETE' });
  }
}

export const matchesApi = new MatchesApi();

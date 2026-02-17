import { Match } from '../types/match';

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
    return (rows || []).map((row: any) => ({
      id: String(row.id),
      home_team: row.home_team ?? '',
      away_team: row.away_team ?? '',
      location: row.location ?? null,
      start_time: row.start_time,
      sport_type: row.sport_type ?? 'football',
      format: row.format ?? '',
      total_minutes: row.total_minutes ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }

  async getMatch(id: string): Promise<Match> {
    const row = await this.request(`/matches/${id}`);
    return {
      id: String(row.id),
      home_team: row.home_team ?? '',
      away_team: row.away_team ?? '',
      location: row.location ?? null,
      start_time: row.start_time,
      sport_type: row.sport_type ?? 'football',
      format: row.format ?? '',
      total_minutes: row.total_minutes ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  async createMatch(data: {
    home_team: string;
    away_team: string;
    location?: string | null;
    start_time: string;
    sport_type: string;
    format: string;
    total_minutes?: number | null;
  }): Promise<Match> {
    const body = {
      home_team: data.home_team,
      away_team: data.away_team,
      location: data.location ?? null,
      start_time: data.start_time,
      sport_type: data.sport_type,
      format: data.format,
      total_minutes: data.total_minutes ?? null,
    };
    const row = await this.request('/matches', { method: 'POST', body: JSON.stringify(body) });
    return {
      id: String(row.id),
      home_team: row.home_team ?? '',
      away_team: row.away_team ?? '',
      location: row.location ?? null,
      start_time: row.start_time,
      sport_type: row.sport_type ?? 'football',
      format: row.format ?? '',
      total_minutes: row.total_minutes ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
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
    };
    const row = await this.request(`/matches/${id}`, { method: 'PUT', body: JSON.stringify(body) });
    return {
      id: String(row.id),
      home_team: row.home_team ?? '',
      away_team: row.away_team ?? '',
      location: row.location ?? null,
      start_time: row.start_time,
      sport_type: row.sport_type ?? 'football',
      format: row.format ?? '',
      total_minutes: row.total_minutes ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  async deleteMatch(id: string): Promise<void> {
    await this.request(`/matches/${id}`, { method: 'DELETE' });
  }
}

export const matchesApi = new MatchesApi();

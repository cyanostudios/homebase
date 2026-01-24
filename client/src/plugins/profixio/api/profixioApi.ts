// client/src/plugins/profixio/api/profixioApi.ts

import {
  ProfixioMatch,
  ProfixioSeason,
  ProfixioTournament,
  ProfixioSettings,
  ProfixioMatchesResponse,
} from '../types/profixio';

class ProfixioApi {
  private basePath = '/api/profixio';
  private csrfToken: string | null = null;

  async getCsrfToken(): Promise<string> {
    if (this.csrfToken) {
      return this.csrfToken;
    }

    const response = await fetch('/api/csrf-token', {
      credentials: 'include',
    });
    const data = await response.json();
    this.csrfToken = data.csrfToken;
    return this.csrfToken;
  }

  private async request(path: string, options: RequestInit = {}) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    // Add CSRF token for mutations
    if (options.method && ['POST', 'PUT', 'DELETE'].includes(options.method)) {
      headers['X-CSRF-Token'] = await this.getCsrfToken();
    }

    let response: Response;
    try {
      response = await fetch(`${this.basePath}${path}`, {
        headers,
        credentials: 'include',
        ...options,
      });
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
        // Response is not JSON, use default error message
      }

      const errorMessage =
        response.status === 409 && payload?.errors?.[0]?.message
          ? payload.errors[0].message
          : payload?.error || payload?.message || response.statusText || 'Request failed';

      const err: any = new Error(errorMessage);
      err.status = response.status;
      err.code = payload?.code;
      err.details = payload?.details;
      if (payload?.errors) {
        err.errors = payload.errors;
      }
      throw err;
    }

    const text = await response.text();
    return text ? JSON.parse(text) : {};
  }

  async getMatches(filters: {
    seasonId?: number;
    tournamentId?: number;
    teamFilter?: string;
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
  }): Promise<ProfixioMatchesResponse> {
    const params = new URLSearchParams();
    if (filters.seasonId) {
      params.append('seasonId', filters.seasonId.toString());
    }
    if (filters.tournamentId) {
      params.append('tournamentId', filters.tournamentId.toString());
    }
    if (filters.teamFilter) {
      params.append('teamFilter', filters.teamFilter);
    }
    if (filters.fromDate) {
      params.append('fromDate', filters.fromDate);
    }
    if (filters.toDate) {
      params.append('toDate', filters.toDate);
    }
    if (filters.page) {
      params.append('page', filters.page.toString());
    }
    if (filters.limit) {
      params.append('limit', filters.limit.toString());
    }

    return this.request(`/matches?${params.toString()}`);
  }

  async getMatch(tournamentId: number, matchId: number): Promise<ProfixioMatch> {
    return this.request(`/matches/${tournamentId}/${matchId}`);
  }

  async getSeasons(organisationId: string, sportId?: string): Promise<{ data: ProfixioSeason[] }> {
    const params = new URLSearchParams();
    params.append('organisationId', organisationId);
    if (sportId) {
      params.append('sportId', sportId);
    }

    return this.request(`/seasons?${params.toString()}`);
  }

  async getTournaments(
    seasonId: number,
    categoryId?: number,
    sportId?: string,
  ): Promise<{ data: ProfixioTournament[] }> {
    const params = new URLSearchParams();
    params.append('seasonId', seasonId.toString());
    if (categoryId) {
      params.append('categoryId', categoryId.toString());
    }
    if (sportId) {
      params.append('sportId', sportId);
    }

    return this.request(`/tournaments?${params.toString()}`);
  }

  async getSettings(): Promise<{ settings: ProfixioSettings }> {
    return this.request('/settings');
  }

  async updateSettings(settings: ProfixioSettings): Promise<{ settings: ProfixioSettings }> {
    return this.request('/settings', {
      method: 'PUT',
      body: JSON.stringify({ settings }),
    });
  }
}

export const profixioApi = new ProfixioApi();

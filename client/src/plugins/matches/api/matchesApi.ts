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
  const home = (row.home_team as string) ?? '';
  const away = (row.away_team as string) ?? '';
  const fallbackName = [home, away].filter(Boolean).join(' – ').trim() || null;
  return {
    id: String(row.id),
    name:
      row.name !== null && row.name !== undefined && String(row.name).trim()
        ? String(row.name).trim()
        : fallbackName,
    match_number:
      row.match_number !== null && row.match_number !== undefined ? Number(row.match_number) : null,
    match_type:
      row.match_type !== null && row.match_type !== undefined
        ? (String(row.match_type) as Match['match_type'])
        : null,
    referee_count:
      row.referee_count !== null && row.referee_count !== undefined ? Number(row.referee_count) : 1,
    map_link: (row.map_link as string) ?? null,
    home_team: home,
    away_team: away,
    location: (row.location as string) ?? null,
    start_time: (row.start_time as string) ?? '',
    sport_type: (row.sport_type as Match['sport_type']) ?? 'football',
    format: (row.format as string) ?? null,
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
    name?: string | null;
    match_number?: number | null;
    match_type?: Match['match_type'];
    referee_count?: number | null;
    map_link?: string | null;
    home_team: string;
    away_team: string;
    location?: string | null;
    start_time: string;
    sport_type: string;
    format?: string | null;
    total_minutes?: number | null;
    contact_id?: string | null;
    mentions?: MatchMention[];
  }): Promise<Match> {
    const fallbackName =
      [data.home_team, data.away_team].filter(Boolean).join(' – ').trim() || null;
    const body = {
      name: data.name?.trim() || fallbackName,
      match_number: data.match_number ?? null,
      match_type: data.match_type ?? null,
      referee_count: data.referee_count ?? 1,
      map_link: data.map_link?.trim() || null,
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
    const fallbackName =
      [data.home_team ?? '', data.away_team ?? ''].filter(Boolean).join(' – ').trim() || null;
    const body = {
      ...('name' in data ? { name: data.name?.trim() || fallbackName } : {}),
      ...('match_number' in data ? { match_number: data.match_number ?? null } : {}),
      ...('match_type' in data ? { match_type: data.match_type ?? null } : {}),
      ...('referee_count' in data ? { referee_count: data.referee_count ?? 1 } : {}),
      ...('map_link' in data ? { map_link: data.map_link?.trim() || null } : {}),
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

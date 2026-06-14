import { createApiClient } from '@/core/api/createApiClient';

import type {
  Responsible,
  SeasonBreak,
  SeriesTeam,
  Team,
  TeamNote,
  TrainingTime,
} from '../types/teams';

function parseJsonArray<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) {
    return raw as T[];
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function rowToTeam(row: Record<string, unknown>): Team {
  return {
    id: String(row.id),
    name: (row.name as string) ?? '',
    age_group: (row.age_group as string) ?? null,
    gender: (row.gender as Team['gender']) ?? null,
    player_count: row.player_count != null ? Number(row.player_count) : 0,
    series_team_count: row.series_team_count != null ? Number(row.series_team_count) : 0,
    series_teams: parseJsonArray<SeriesTeam>(row.series_teams),
    status: (row.status as Team['status']) ?? 'active',
    status_note: (row.status_note as string) ?? null,
    team_notes: parseJsonArray<TeamNote>(row.team_notes),
    training_times: parseJsonArray<TrainingTime>(row.training_times),
    season_breaks: parseJsonArray<SeasonBreak>(row.season_breaks),
    responsibles: parseJsonArray<Responsible>(row.responsibles),
    color: (row.color as Team['color']) ?? 'green',
    external_team_id:
      row.external_team_id != null && String(row.external_team_id).trim()
        ? String(row.external_team_id).trim()
        : null,
    created_at: (row.created_at as string) ?? '',
    updated_at: (row.updated_at as string) ?? '',
  };
}

export interface TeamPayload {
  name: string;
  age_group?: string | null;
  gender?: Team['gender'];
  player_count?: number | null;
  series_team_count?: number | null;
  series_teams?: SeriesTeam[];
  status?: Team['status'];
  status_note?: string | null;
  team_notes?: TeamNote[];
  training_times?: TrainingTime[];
  season_breaks?: SeasonBreak[];
  responsibles?: Responsible[];
  color?: Team['color'];
  external_team_id?: string | null;
}

class TeamsApi {
  private request = createApiClient('/teams');

  async getTeams(): Promise<Team[]> {
    const rows = await this.request('');
    return (rows || []).map((row: Record<string, unknown>) => rowToTeam(row));
  }

  async createTeam(data: TeamPayload): Promise<Team> {
    const row = await this.request('', { method: 'POST', body: JSON.stringify(data) });
    return rowToTeam(row);
  }

  async updateTeam(id: string, data: TeamPayload): Promise<Team> {
    const row = await this.request(`/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    return rowToTeam(row);
  }

  async deleteTeam(id: string): Promise<void> {
    await this.request(`/${id}`, { method: 'DELETE' });
  }
}

export const teamsApi = new TeamsApi();

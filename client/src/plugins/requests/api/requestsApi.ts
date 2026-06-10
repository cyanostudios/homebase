import { createApiClient } from '@/core/api/createApiClient';

import type { PublicTeam, Request } from '../types/requests';

function rowToRequest(row: Record<string, unknown>): Request {
  let assignedToIds: string[] = [];
  const raw = row.assignedToIds ?? row.assigned_to_ids;
  if (Array.isArray(raw)) {
    assignedToIds = raw.map(String);
  } else if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      assignedToIds = Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      assignedToIds = [];
    }
  }

  return {
    id: String(row.id),
    title: (row.title as string) ?? '',
    description: (row.description as string) ?? null,
    requestType: (row.requestType ?? row.request_type) as Request['requestType'],
    status: (row.status as Request['status']) ?? 'not started',
    priority: (row.priority as Request['priority']) ?? 'Medium',
    teamId:
      row.teamId != null ? Number(row.teamId) : row.team_id != null ? Number(row.team_id) : null,
    submitterName: (row.submitterName ?? row.submitter_name) as string | null,
    submitterEmail: (row.submitterEmail ?? row.submitter_email) as string | null,
    contactId:
      (row.contactId ?? row.contact_id) != null ? String(row.contactId ?? row.contact_id) : null,
    assignedToIds,
    internalNotes: (row.internalNotes ?? row.internal_notes) as string | null,
    source: ((row.source as string) ?? 'internal') as Request['source'],
    created_at: (row.created_at as string) ?? '',
    updated_at: (row.updated_at as string) ?? '',
  };
}

export interface RequestPayload {
  title: string;
  description?: string | null;
  request_type?: Request['requestType'];
  status?: Request['status'];
  priority?: Request['priority'];
  team_id?: number | null;
  submitter_name?: string | null;
  submitter_email?: string | null;
  contact_id?: string | null;
  assigned_to_ids?: string[];
  internal_notes?: string | null;
  source?: Request['source'];
}

export interface PublicRequestPayload {
  title: string;
  description?: string;
  request_type?: string;
  team_id?: number | null;
  submitter_name?: string;
  submitter_email?: string;
}

class RequestsApi {
  private request = createApiClient('/requests');

  async getRequests(params?: {
    team_id?: number;
    status?: string;
    request_type?: string;
  }): Promise<Request[]> {
    const query = params
      ? '?' +
        new URLSearchParams(
          Object.entries(params)
            .filter(([, v]) => v != null)
            .map(([k, v]) => [k, String(v)]),
        ).toString()
      : '';
    const rows = await this.request(query);
    return (rows || []).map((row: Record<string, unknown>) => rowToRequest(row));
  }

  async getRequest(id: string): Promise<Request> {
    const row = await this.request(`/${id}`);
    return rowToRequest(row);
  }

  async createRequest(data: RequestPayload): Promise<Request> {
    const row = await this.request('', { method: 'POST', body: JSON.stringify(data) });
    return rowToRequest(row);
  }

  async updateRequest(id: string, data: RequestPayload): Promise<Request> {
    const row = await this.request(`/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    return rowToRequest(row);
  }

  async deleteRequest(id: string): Promise<void> {
    await this.request(`/${id}`, { method: 'DELETE' });
  }

  async publicGetTeams(): Promise<PublicTeam[]> {
    const rows = await this.request('/public/teams');
    return rows || [];
  }

  async publicSubmit(data: PublicRequestPayload): Promise<{ success: boolean; request: Request }> {
    const result = await this.request('/public/submit', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return result;
  }
}

export const requestsApi = new RequestsApi();

import { createApiClient } from '@/core/api/createApiClient';

import type { PublicTeam, Request } from '../types/requests';
import { normalizePublicBranding, type PublicBranding } from '../utils/publicBranding';

export type { PublicBranding };

function parseExtraData(raw: unknown): Record<string, string> | null {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (value === null || value === undefined || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === 'string' && entry.trim()) {
      out[key] = entry;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

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
      row.teamId !== null && row.teamId !== undefined
        ? Number(row.teamId)
        : row.team_id !== null && row.team_id !== undefined
          ? Number(row.team_id)
          : null,
    submitterName: (row.submitterName ?? row.submitter_name) as string | null,
    submitterEmail: (row.submitterEmail ?? row.submitter_email) as string | null,
    contactId: (() => {
      const rawContact = row.contactId ?? row.contact_id;
      return rawContact !== null && rawContact !== undefined ? String(rawContact) : null;
    })(),
    assignedToIds,
    internalNotes: (row.internalNotes ?? row.internal_notes) as string | null,
    source: ((row.source as string) ?? 'internal') as Request['source'],
    responseDueAt: ((row.responseDueAt ?? row.response_due_at) as string | null) ?? null,
    pluginTarget: ((row.pluginTarget ?? row.plugin_target) as string | null) ?? null,
    pluginTargetId: (() => {
      const rawId = row.pluginTargetId ?? row.plugin_target_id;
      return rawId !== null && rawId !== undefined ? String(rawId) : null;
    })(),
    extraData: parseExtraData(row.extraData ?? row.extra_data),
    pluginRoutedAt: ((row.pluginRoutedAt ?? row.plugin_routed_at) as string | null) ?? null,
    pluginRoutedEntityId: (() => {
      const rawEntity = row.pluginRoutedEntityId ?? row.plugin_routed_entity_id;
      return rawEntity !== null && rawEntity !== undefined ? String(rawEntity) : null;
    })(),
    firstViewedAt: ((row.firstViewedAt ?? row.first_viewed_at) as string | null) ?? null,
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
  response_due_at?: string | null;
  extra_data?: Record<string, string> | null;
}

export interface PublicRequestPayload {
  title: string;
  description?: string;
  request_type?: string;
  team_id?: number | null;
  submitter_name?: string;
  submitter_email?: string;
  extra_data?: Record<string, string>;
}

export interface SendToListResult {
  request: Request;
  person: Record<string, unknown>;
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
            .filter(([, v]) => v !== null && v !== undefined)
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

  async sendToList(id: string): Promise<SendToListResult> {
    const result = await this.request(`/${id}/send-to-list`, { method: 'POST' });
    return {
      request: rowToRequest(result.request as Record<string, unknown>),
      person: (result.person as Record<string, unknown>) ?? {},
    };
  }

  async markViewed(id: string): Promise<Request> {
    const row = await this.request(`/${id}/mark-viewed`, { method: 'POST' });
    return rowToRequest(row);
  }

  async publicGetTeams(): Promise<PublicTeam[]> {
    const rows = await this.request('/public/teams');
    return rows || [];
  }

  async publicGetBranding(): Promise<PublicBranding> {
    const row = await this.request('/public/branding');
    return normalizePublicBranding(row);
  }

  async publicSubmit(data: PublicRequestPayload): Promise<{ success: boolean }> {
    const result = await this.request('/public/submit', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return result;
  }
}

export const requestsApi = new RequestsApi();

import { Slot, SlotMention } from '../types/slots';

function parseMentions(row: Record<string, unknown>): SlotMention[] {
  let raw = row.mentions;
  if (raw === null || raw === undefined) {
    return [];
  }
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw) as SlotMention[];
    } catch {
      return [];
    }
  }
  return Array.isArray(raw) ? (raw as SlotMention[]) : [];
}

function rowToSlot(row: Record<string, unknown>): Slot {
  const cap = row.capacity !== undefined && row.capacity !== null ? Number(row.capacity) : 1;
  return {
    id: String(row.id),
    location: (row.location as string) ?? null,
    slot_time: (row.slot_time as string) ?? '',
    capacity: Number.isNaN(cap) ? 1 : Math.min(5, Math.max(1, cap)),
    visible: Boolean(row.visible),
    notifications_enabled: Boolean(row.notifications_enabled),
    contact_id:
      row.contact_id !== null && row.contact_id !== undefined ? String(row.contact_id) : null,
    mentions: parseMentions(row),
    created_at: (row.created_at as string) ?? '',
    updated_at: (row.updated_at as string) ?? '',
    match_id:
      row.match_id !== null && row.match_id !== undefined ? String(row.match_id) : undefined,
  };
}

class SlotsApi {
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
    } catch (error: unknown) {
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
      const err = new Error(
        (error as { error?: string; message?: string })?.error ||
          (error as { error?: string; message?: string })?.message ||
          'Request failed',
      ) as Error & { status?: number; code?: string; details?: unknown };
      err.status = response.status;
      err.code = (error as { code?: string }).code;
      err.details = (error as { details?: unknown }).details;
      throw err;
    }

    return response.json();
  }

  async getSlots(): Promise<Slot[]> {
    const rows = await this.request('/slots');
    return (rows || []).map((row: Record<string, unknown>) => rowToSlot(row));
  }

  async getSlot(id: string): Promise<Slot> {
    const row = await this.request(`/slots/${id}`);
    return rowToSlot(row);
  }

  async createSlot(data: {
    location?: string | null;
    slot_time: string;
    capacity?: number;
    visible?: boolean;
    notifications_enabled?: boolean;
    contact_id?: string | null;
    mentions?: SlotMention[];
    match_id?: string | null;
  }): Promise<Slot> {
    const body = {
      location: data.location ?? null,
      slot_time: data.slot_time,
      capacity: data.capacity ?? 1,
      visible: data.visible !== false,
      notifications_enabled: data.notifications_enabled !== false,
      contact_id: data.contact_id ?? null,
      mentions: data.mentions ?? [],
      match_id: data.match_id ?? null,
    };
    const row = await this.request('/slots', { method: 'POST', body: JSON.stringify(body) });
    return rowToSlot(row);
  }

  async createBatchSlots(
    slots: Array<{
      location?: string | null;
      slot_time: string;
      capacity?: number;
      visible?: boolean;
      notifications_enabled?: boolean;
      contact_id?: string | null;
      mentions?: SlotMention[];
    }>,
  ): Promise<Slot[]> {
    const body = { slots };
    const rows = await this.request('/slots/batch', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return Array.isArray(rows) ? rows.map((row: Record<string, unknown>) => rowToSlot(row)) : [];
  }

  async updateSlot(id: string, data: Partial<Slot>): Promise<Slot> {
    const body = {
      location: data.location ?? null,
      slot_time: data.slot_time,
      capacity: data.capacity ?? 1,
      visible: data.visible !== false,
      notifications_enabled: data.notifications_enabled !== false,
      contact_id: data.contact_id ?? null,
      mentions: data.mentions ?? [],
    };
    const row = await this.request(`/slots/${id}`, { method: 'PUT', body: JSON.stringify(body) });
    return rowToSlot(row);
  }

  async deleteSlot(id: string): Promise<void> {
    await this.request(`/slots/${id}`, { method: 'DELETE' });
  }
}

export const slotsApi = new SlotsApi();

import { Slot } from '../types/kiosk';

class KioskApi {
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
    const rows = await this.request('/kiosk');
    return (rows || []).map((row: Record<string, unknown>) => {
      const cap = Number(row.capacity);
      return {
        id: String(row.id),
        location: (row.location as string) ?? null,
        slot_time: (row.slot_time as string) ?? '',
        capacity: Number.isNaN(cap) ? 1 : Math.min(5, Math.max(1, cap)),
        visible: Boolean(row.visible),
        notifications_enabled: Boolean(row.notifications_enabled),
        created_at: (row.created_at as string) ?? '',
        updated_at: (row.updated_at as string) ?? '',
      };
    });
  }

  async getSlot(id: string): Promise<Slot> {
    const row = await this.request(`/kiosk/${id}`);
    return {
      id: String(row.id),
      location: (row.location as string) ?? null,
      slot_time: (row.slot_time as string) ?? '',
      capacity: row.capacity !== undefined && row.capacity !== null ? Number(row.capacity) : 1,
      visible: Boolean(row.visible),
      notifications_enabled: Boolean(row.notifications_enabled),
      created_at: (row.created_at as string) ?? '',
      updated_at: (row.updated_at as string) ?? '',
    };
  }

  async createSlot(data: {
    location?: string | null;
    slot_time: string;
    capacity?: number;
    visible?: boolean;
    notifications_enabled?: boolean;
  }): Promise<Slot> {
    const body = {
      location: data.location ?? null,
      slot_time: data.slot_time,
      capacity: data.capacity ?? 1,
      visible: data.visible !== false,
      notifications_enabled: data.notifications_enabled !== false,
    };
    const row = await this.request('/kiosk', { method: 'POST', body: JSON.stringify(body) });
    const capCreate = Number(row.capacity);
    return {
      id: String(row.id),
      location: (row.location as string) ?? null,
      slot_time: (row.slot_time as string) ?? '',
      capacity: Number.isNaN(capCreate) ? 1 : Math.min(5, Math.max(1, capCreate)),
      visible: Boolean(row.visible),
      notifications_enabled: Boolean(row.notifications_enabled),
      created_at: (row.created_at as string) ?? '',
      updated_at: (row.updated_at as string) ?? '',
    };
  }

  async updateSlot(id: string, data: Partial<Slot>): Promise<Slot> {
    const body = {
      location: data.location ?? null,
      slot_time: data.slot_time,
      capacity: data.capacity ?? 1,
      visible: data.visible !== false,
      notifications_enabled: data.notifications_enabled !== false,
    };
    const row = await this.request(`/kiosk/${id}`, { method: 'PUT', body: JSON.stringify(body) });
    const capUpdate = Number(row.capacity);
    return {
      id: String(row.id),
      location: (row.location as string) ?? null,
      slot_time: (row.slot_time as string) ?? '',
      capacity: Number.isNaN(capUpdate) ? 1 : Math.min(5, Math.max(1, capUpdate)),
      visible: Boolean(row.visible),
      notifications_enabled: Boolean(row.notifications_enabled),
      created_at: (row.created_at as string) ?? '',
      updated_at: (row.updated_at as string) ?? '',
    };
  }

  async deleteSlot(id: string): Promise<void> {
    await this.request(`/kiosk/${id}`, { method: 'DELETE' });
  }
}

export const kioskApi = new KioskApi();

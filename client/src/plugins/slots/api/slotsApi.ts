import { createApiClient } from '@/core/api/createApiClient';

import { Slot, SlotMention, SlotBooking } from '../types/slots';

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
  const bookedCount =
    row.booked_count !== undefined && row.booked_count !== null ? Number(row.booked_count) : 0;
  return {
    id: String(row.id),
    name: row.name !== null && row.name !== undefined ? String(row.name).trim() || null : null,
    location: (row.location as string) ?? null,
    slot_time: (row.slot_time as string) ?? '',
    slot_end: row.slot_end !== null && row.slot_end !== undefined ? String(row.slot_end) : null,
    address:
      row.address !== null && row.address !== undefined ? String(row.address).trim() || null : null,
    category:
      row.category !== null && row.category !== undefined
        ? String(row.category).trim() || null
        : null,
    capacity: Number.isNaN(cap) ? 1 : Math.min(5, Math.max(1, cap)),
    visible: Boolean(row.visible),
    notifications_enabled: Boolean(row.notifications_enabled),
    contact_id:
      row.contact_id !== null && row.contact_id !== undefined ? String(row.contact_id) : null,
    mentions: parseMentions(row),
    description:
      row.description !== null && row.description !== undefined
        ? String(row.description).trim() || null
        : null,
    created_at: (row.created_at as string) ?? '',
    updated_at: (row.updated_at as string) ?? '',
    match_id:
      row.match_id !== null && row.match_id !== undefined ? String(row.match_id) : undefined,
    booked_count: Number.isNaN(bookedCount) ? 0 : bookedCount,
  };
}

class SlotsApi {
  private request = createApiClient('/slots');

  async getSlots(): Promise<Slot[]> {
    const rows = await this.request('');
    return (rows || []).map((row: Record<string, unknown>) => rowToSlot(row));
  }

  async createSlot(data: {
    name?: string | null;
    location?: string | null;
    slot_time: string;
    slot_end?: string | null;
    address?: string | null;
    category?: string | null;
    capacity?: number;
    visible?: boolean;
    notifications_enabled?: boolean;
    contact_id?: string | null;
    mentions?: SlotMention[];
    match_id?: string | null;
    description?: string | null;
  }): Promise<Slot> {
    const body = {
      name: data.name !== null && data.name !== undefined ? String(data.name).trim() || null : null,
      location: data.location ?? null,
      slot_time: data.slot_time,
      slot_end: data.slot_end ?? null,
      address:
        data.address !== null && data.address !== undefined
          ? String(data.address).trim() || null
          : null,
      category:
        data.category !== null && data.category !== undefined
          ? String(data.category).trim() || null
          : null,
      capacity: data.capacity ?? 1,
      visible: data.visible !== false,
      notifications_enabled: data.notifications_enabled !== false,
      contact_id: data.contact_id ?? null,
      mentions: data.mentions ?? [],
      match_id: data.match_id ?? null,
      description:
        data.description !== null && data.description !== undefined
          ? String(data.description).trim() || null
          : null,
    };
    const row = await this.request('', { method: 'POST', body: JSON.stringify(body) });
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
      category?: string | null;
    }>,
  ): Promise<Slot[]> {
    const body = { slots };
    const rows = await this.request('/batch', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return Array.isArray(rows) ? rows.map((row: Record<string, unknown>) => rowToSlot(row)) : [];
  }

  async updateSlot(id: string, data: Partial<Slot>): Promise<Slot> {
    const body: Record<string, unknown> = {
      location: data.location ?? null,
      slot_time: data.slot_time,
      slot_end: data.slot_end ?? null,
      capacity: data.capacity ?? 1,
      visible: data.visible !== false,
      notifications_enabled: data.notifications_enabled !== false,
      contact_id: data.contact_id ?? null,
      mentions: data.mentions ?? [],
    };
    if (data.name !== undefined) {
      body.name =
        data.name !== null && data.name !== undefined ? String(data.name).trim() || null : null;
    }
    if (data.address !== undefined) {
      body.address =
        data.address !== null && data.address !== undefined
          ? String(data.address).trim() || null
          : null;
    }
    if (data.description !== undefined) {
      body.description =
        data.description !== null && data.description !== undefined
          ? String(data.description).trim() || null
          : null;
    }
    if (data.category !== undefined) {
      body.category =
        data.category !== null && data.category !== undefined
          ? String(data.category).trim() || null
          : null;
    }
    const row = await this.request(`/${id}`, { method: 'PUT', body: JSON.stringify(body) });
    return rowToSlot(row);
  }

  async deleteSlot(id: string): Promise<void> {
    await this.request(`/${id}`, { method: 'DELETE' });
  }

  async getBookings(slotId: string): Promise<SlotBooking[]> {
    const rows = await this.request(`/${slotId}/bookings`);
    return (rows || []).map((row: Record<string, unknown>) => ({
      id: String(row.id),
      slot_id: String(row.slot_id),
      name: (row.name as string) ?? '',
      email: (row.email as string) ?? null,
      phone: (row.phone as string) ?? null,
      message: (row.message as string) ?? null,
      created_at: (row.created_at as string) ?? '',
    }));
  }

  async deleteBooking(bookingId: string): Promise<void> {
    await this.request(`/bookings/${bookingId}`, { method: 'DELETE' });
  }
}

export const slotsApi = new SlotsApi();

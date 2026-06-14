import { createApiClient } from '@/core/api/createApiClient';
import type { TrainingTime } from '@/plugins/teams/types/teams';

import type { PlanEvent, SchedulePlan, SchedulePlanWithEvents } from '../types/schedule';

export interface PlanEventPayload {
  title: string;
  event_type?: 'recurring' | 'date_based';
  day?: string;
  event_date?: string | null;
  start_time: string;
  end_time: string;
  location?: string;
  team_id?: number | null;
}

function rowToPlan(row: Record<string, unknown>): SchedulePlan {
  return {
    id: String(row.id),
    name: (row.name as string) ?? '',
    color: (row.color as string) ?? 'blue',
    is_team_calendar: Boolean(row.is_team_calendar),
    event_count: Number(row.event_count ?? 0),
    created_at: row.created_at as string | undefined,
    updated_at: row.updated_at as string | undefined,
  };
}

function rowToEvent(row: Record<string, unknown>): PlanEvent {
  return {
    id: String(row.id),
    schedule_id: String(row.schedule_id),
    title: (row.title as string) ?? '',
    event_type: (row.event_type as PlanEvent['event_type']) ?? 'recurring',
    day: (row.day as string | null) ?? null,
    event_date: row.event_date ? String(row.event_date).slice(0, 10) : null,
    start_time: (row.start_time as string) ?? '',
    end_time: (row.end_time as string) ?? '',
    location: (row.location as string) ?? '',
    team_id: row.team_id != null ? String(row.team_id) : null,
    created_at: row.created_at as string | undefined,
    updated_at: row.updated_at as string | undefined,
  };
}

class ScheduleApi {
  private request = createApiClient('/schedule');

  async getSchedules(): Promise<SchedulePlan[]> {
    const rows = await this.request('');
    return (rows || []).map((row: Record<string, unknown>) => rowToPlan(row));
  }

  async createSchedule(name: string, color = 'blue'): Promise<SchedulePlan> {
    const row = await this.request('', {
      method: 'POST',
      body: JSON.stringify({ name, color }),
    });
    return rowToPlan(row);
  }

  async renameSchedule(id: string, name: string): Promise<SchedulePlan> {
    const row = await this.request(`/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    });
    return rowToPlan(row);
  }

  async deleteSchedule(id: string): Promise<void> {
    await this.request(`/${id}`, { method: 'DELETE' });
  }

  async getSchedule(id: string): Promise<SchedulePlanWithEvents> {
    const row = await this.request(`/${id}`);
    const plan = rowToPlan(row);
    const events = Array.isArray(row.events)
      ? row.events.map((event: Record<string, unknown>) => rowToEvent(event))
      : [];
    return { ...plan, events };
  }

  async createEvent(scheduleId: string, payload: PlanEventPayload): Promise<PlanEvent> {
    const row = await this.request(`/${scheduleId}/events`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return rowToEvent(row);
  }

  async updateEvent(
    scheduleId: string,
    eventId: string,
    payload: PlanEventPayload,
  ): Promise<PlanEvent> {
    const row = await this.request(`/${scheduleId}/events/${eventId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return rowToEvent(row);
  }

  async deleteEvent(scheduleId: string, eventId: string): Promise<void> {
    await this.request(`/${scheduleId}/events/${eventId}`, { method: 'DELETE' });
  }

  async clearAllEvents(scheduleId: string): Promise<number> {
    const schedule = await this.getSchedule(scheduleId);
    for (const event of schedule.events) {
      await this.deleteEvent(scheduleId, event.id);
    }
    return schedule.events.length;
  }

  async getEventsGroupedByTeam(scheduleId: string): Promise<Record<string, TrainingTime[]>> {
    const schedule = await this.getSchedule(scheduleId);
    const result: Record<string, TrainingTime[]> = {};
    for (const event of schedule.events) {
      if (!event.team_id || event.event_type !== 'recurring') {
        continue;
      }
      const teamId = String(event.team_id);
      const times = result[teamId] ?? [];
      times.push({
        day: event.day ?? '',
        startTime: event.start_time,
        endTime: event.end_time,
        location: event.location ?? '',
      });
      result[teamId] = times;
    }
    return result;
  }
}

export const scheduleApi = new ScheduleApi();

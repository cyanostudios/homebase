import type { Team } from '@/plugins/teams/types/teams';

import {
  buildPlanSlots,
  buildTeamSlots,
  getPreferredTeamIdFromFilter,
  toggleScheduleTeamFilter,
  type PlanEvent,
} from '../../types/schedule';

function team(id: string, name: string): Team {
  return {
    id,
    name,
    color: 'blue',
    training_times: [
      {
        day: 'monday',
        startTime: '17:00',
        endTime: '18:00',
        location: 'Hall',
      },
    ],
  } as Team;
}

function planEvent(id: string, teamId: string | null): PlanEvent {
  return {
    id,
    schedule_id: 'plan-1',
    title: 'Pass',
    event_type: 'recurring',
    day: 'monday',
    event_date: null,
    start_time: '17:00',
    end_time: '18:00',
    location: 'Hall',
    team_id: teamId,
  };
}

describe('schedule multi team filter', () => {
  const teams = [team('1', 'A'), team('2', 'B'), team('3', 'C')];

  it('toggles teams without replacing the previous selection', () => {
    expect(toggleScheduleTeamFilter([], '1')).toEqual(['1']);
    expect(toggleScheduleTeamFilter(['1'], '2')).toEqual(['1', '2']);
    expect(toggleScheduleTeamFilter(['1', '2'], '1')).toEqual(['2']);
    expect(toggleScheduleTeamFilter(['2'], '2')).toEqual([]);
  });

  it('buildTeamSlots includes all selected teams', () => {
    const slots = buildTeamSlots(teams, ['1', '3']);
    expect(slots.map((slot) => String(slot.teamId)).sort()).toEqual(['1', '3']);
  });

  it('buildTeamSlots with empty filter returns all teams', () => {
    expect(
      buildTeamSlots(teams, [])
        .map((slot) => String(slot.teamId))
        .sort(),
    ).toEqual(['1', '2', '3']);
  });

  it('buildPlanSlots includes all selected teams', () => {
    const events = [planEvent('e1', '1'), planEvent('e2', '2'), planEvent('e3', '3')];
    const slots = buildPlanSlots(events, teams, ['2', '3']);
    expect(slots.map((slot) => String(slot.teamId)).sort()).toEqual(['2', '3']);
  });

  it('preferred team id only when exactly one team is selected', () => {
    expect(getPreferredTeamIdFromFilter([])).toBeUndefined();
    expect(getPreferredTeamIdFromFilter(['2'])).toBe('2');
    expect(getPreferredTeamIdFromFilter(['1', '2'])).toBeUndefined();
  });
});

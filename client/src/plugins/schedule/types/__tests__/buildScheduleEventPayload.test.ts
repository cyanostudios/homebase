import type { TrainingTime } from '@/plugins/teams/types/teams';

import { SCHEDULE_NO_TEAM_VALUE, buildScheduleEventPayload } from '../../types/schedule';

const training: TrainingTime = {
  day: 'monday',
  startTime: '17:00',
  endTime: '18:00',
  location: 'Pitch A',
};

const teams = [{ id: '10', name: 'Flickor 2017' }];

describe('buildScheduleEventPayload', () => {
  it('sets team_id and title from team when teamId is set', () => {
    expect(buildScheduleEventPayload('10', training, teams, 'No team')).toEqual({
      title: 'Flickor 2017',
      event_type: 'recurring',
      day: 'monday',
      start_time: '17:00',
      end_time: '18:00',
      location: 'Pitch A',
      venue_id: null,
      team_id: 10,
      counts_toward_capacity: true,
    });
  });

  it('clears team_id and uses no-team title for sentinel / empty', () => {
    expect(buildScheduleEventPayload(SCHEDULE_NO_TEAM_VALUE, training, teams, 'Inget lag')).toEqual(
      {
        title: 'Inget lag',
        event_type: 'recurring',
        day: 'monday',
        start_time: '17:00',
        end_time: '18:00',
        location: 'Pitch A',
        venue_id: null,
        team_id: null,
        counts_toward_capacity: true,
      },
    );

    expect(buildScheduleEventPayload('', training, teams, 'No team').team_id).toBeNull();
  });

  it('maps venueId to venue_id', () => {
    expect(
      buildScheduleEventPayload('10', { ...training, venueId: '12' }, teams, 'No team').venue_id,
    ).toBe(12);
  });

  it('maps countsTowardCapacity false to counts_toward_capacity false', () => {
    expect(
      buildScheduleEventPayload(
        '10',
        { ...training, countsTowardCapacity: false },
        teams,
        'No team',
      ).counts_toward_capacity,
    ).toBe(false);
  });
});

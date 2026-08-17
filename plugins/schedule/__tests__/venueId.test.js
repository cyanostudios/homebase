const ScheduleModel = require('../model');

describe('schedule event venue_id', () => {
  let model;

  beforeEach(() => {
    model = new ScheduleModel();
  });

  test('buildEventPayload preserves optional venue_id on create payload', () => {
    expect(
      model.buildEventPayload('recurring', {
        title: 'Training',
        day: 'monday',
        start_time: '17:00',
        end_time: '18:00',
        location: 'Pitch A',
        venue_id: 12,
      }).venue_id,
    ).toBe(12);
  });

  test('buildEventPayload omits invalid venue_id as null', () => {
    expect(
      model.buildEventPayload('recurring', {
        title: 'Training',
        day: 'monday',
        venue_id: 'nope',
      }).venue_id,
    ).toBeNull();
  });

  test('transformEventRow includes venue_id without rewriting missing values', () => {
    expect(
      model.transformEventRow({
        id: 1,
        schedule_id: 2,
        title: 'Training',
        event_type: 'recurring',
        day: 'monday',
        event_date: null,
        start_time: '17:00',
        end_time: '18:00',
        location: 'Pitch A',
        team_id: 10,
        venue_id: 12,
        counts_toward_capacity: true,
        created_at: 'a',
        updated_at: 'b',
      }).venue_id,
    ).toBe('12');

    expect(
      model.transformEventRow({
        id: 1,
        schedule_id: 2,
        title: 'Legacy',
        event_type: 'recurring',
        day: 'monday',
        event_date: null,
        start_time: '17:00',
        end_time: '18:00',
        location: '',
        team_id: null,
        counts_toward_capacity: true,
        created_at: 'a',
        updated_at: 'b',
      }).venue_id,
    ).toBeNull();
  });
});

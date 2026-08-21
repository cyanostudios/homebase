import {
  buildRequestAssigneesSavePayload,
  buildRequestListPrioritySavePayload,
  buildRequestListStatusSavePayload,
  buildRequestTeamSavePayload,
  shouldApplyOpenRequestSaveEffects,
} from '../requestListSave';

describe('shouldApplyOpenRequestSaveEffects', () => {
  it('returns true when open request matches updated id', () => {
    expect(shouldApplyOpenRequestSaveEffects('42', '42')).toBe(true);
  });

  it('returns false when open request is a different id', () => {
    expect(shouldApplyOpenRequestSaveEffects('1', '2')).toBe(false);
  });

  it('returns false when no request is open', () => {
    expect(shouldApplyOpenRequestSaveEffects(null, '2')).toBe(false);
    expect(shouldApplyOpenRequestSaveEffects(undefined, '2')).toBe(false);
    expect(shouldApplyOpenRequestSaveEffects('', '2')).toBe(false);
  });

  it('compares ids as strings', () => {
    expect(shouldApplyOpenRequestSaveEffects(1 as unknown as string, '1')).toBe(true);
  });
});

describe('buildRequestListStatusSavePayload', () => {
  it('applies new status and keeps title', () => {
    expect(buildRequestListStatusSavePayload({ title: 'Pitch booking' }, 'in progress')).toEqual({
      title: 'Pitch booking',
      status: 'in progress',
    });
  });
});

describe('buildRequestListPrioritySavePayload', () => {
  it('applies new priority and keeps title', () => {
    expect(buildRequestListPrioritySavePayload({ title: 'Pitch booking' }, 'High')).toEqual({
      title: 'Pitch booking',
      priority: 'High',
    });
  });
});

describe('buildRequestAssigneesSavePayload', () => {
  it('applies new assignee ids and keeps title', () => {
    expect(buildRequestAssigneesSavePayload({ title: 'Pitch booking' }, ['1', '2'])).toEqual({
      title: 'Pitch booking',
      assigned_to_ids: ['1', '2'],
    });
  });

  it('coerces non-string ids to strings', () => {
    expect(
      buildRequestAssigneesSavePayload({ title: 'Pitch booking' }, [1, 2] as unknown as string[]),
    ).toEqual({
      title: 'Pitch booking',
      assigned_to_ids: ['1', '2'],
    });
  });

  it('supports clearing all assignees', () => {
    expect(buildRequestAssigneesSavePayload({ title: 'Pitch booking' }, [])).toEqual({
      title: 'Pitch booking',
      assigned_to_ids: [],
    });
  });
});

describe('buildRequestTeamSavePayload', () => {
  it('applies new team id and keeps title', () => {
    expect(buildRequestTeamSavePayload({ title: 'Pitch booking' }, '5')).toEqual({
      title: 'Pitch booking',
      team_id: 5,
    });
  });

  it('clears the team when null is passed', () => {
    expect(buildRequestTeamSavePayload({ title: 'Pitch booking' }, null)).toEqual({
      title: 'Pitch booking',
      team_id: null,
    });
  });
});

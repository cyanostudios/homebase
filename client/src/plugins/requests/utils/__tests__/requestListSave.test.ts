import {
  buildRequestListStatusSavePayload,
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

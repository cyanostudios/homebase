import { isRequestUnopened } from '../requests';

describe('isRequestUnopened', () => {
  it('returns true when firstViewedAt is null', () => {
    expect(isRequestUnopened({ firstViewedAt: null })).toBe(true);
  });

  it('returns false when firstViewedAt is set', () => {
    expect(isRequestUnopened({ firstViewedAt: '2026-08-24T10:00:00.000Z' })).toBe(false);
  });
});

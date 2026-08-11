import { isOpenRequestStatus } from '../requests';

describe('isOpenRequestStatus', () => {
  it('treats not started and in progress as open', () => {
    expect(isOpenRequestStatus('not started')).toBe(true);
    expect(isOpenRequestStatus('in progress')).toBe(true);
  });

  it('hides completed and cancelled from team overview', () => {
    expect(isOpenRequestStatus('completed')).toBe(false);
    expect(isOpenRequestStatus('cancelled')).toBe(false);
  });
});

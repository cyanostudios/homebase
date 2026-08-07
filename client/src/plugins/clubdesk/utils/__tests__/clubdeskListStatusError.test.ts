import { getClubdeskListStatusErrorMessage } from '../clubdeskListStatusError';

describe('getClubdeskListStatusErrorMessage', () => {
  it('returns null when there are no validation errors', () => {
    expect(getClubdeskListStatusErrorMessage([])).toBeNull();
  });

  it('surfaces publish-without-steps (field: steps)', () => {
    expect(
      getClubdeskListStatusErrorMessage([
        { field: 'steps', message: 'Add at least one step before publishing.' },
      ]),
    ).toBe('Add at least one step before publishing.');
  });

  it('surfaces general update failures', () => {
    expect(
      getClubdeskListStatusErrorMessage([
        { field: 'general', message: 'Failed to save clubdesk.' },
      ]),
    ).toBe('Failed to save clubdesk.');
  });

  it('joins multiple validation messages', () => {
    expect(
      getClubdeskListStatusErrorMessage([
        { field: 'steps', message: 'Add at least one step before publishing.' },
        { field: 'general', message: 'Failed to save clubdesk.' },
      ]),
    ).toBe('Add at least one step before publishing. Failed to save clubdesk.');
  });
});

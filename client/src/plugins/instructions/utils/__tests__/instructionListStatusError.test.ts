import { getInstructionListStatusErrorMessage } from '../instructionListStatusError';

describe('getInstructionListStatusErrorMessage', () => {
  it('returns null when there are no validation errors', () => {
    expect(getInstructionListStatusErrorMessage([])).toBeNull();
  });

  it('surfaces publish-without-steps (field: steps)', () => {
    expect(
      getInstructionListStatusErrorMessage([
        { field: 'steps', message: 'Add at least one step before publishing.' },
      ]),
    ).toBe('Add at least one step before publishing.');
  });

  it('surfaces general update failures', () => {
    expect(
      getInstructionListStatusErrorMessage([
        { field: 'general', message: 'Failed to save instruction.' },
      ]),
    ).toBe('Failed to save instruction.');
  });

  it('joins multiple validation messages', () => {
    expect(
      getInstructionListStatusErrorMessage([
        { field: 'steps', message: 'Add at least one step before publishing.' },
        { field: 'general', message: 'Failed to save instruction.' },
      ]),
    ).toBe('Add at least one step before publishing. Failed to save instruction.');
  });
});

import { CUPS_SETTINGS_KEY } from '../cupColumnCount';

describe('cupColumnCount', () => {
  it('exports the cups settings key', () => {
    expect(CUPS_SETTINGS_KEY).toBe('cups');
  });
});

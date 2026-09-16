import { MATCHES_SETTINGS_KEY } from '../matchColumnCount';

describe('matchColumnCount', () => {
  it('exports the matches settings key', () => {
    expect(MATCHES_SETTINGS_KEY).toBe('matches');
  });
});

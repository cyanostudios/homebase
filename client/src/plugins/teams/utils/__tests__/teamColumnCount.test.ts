import { TEAMS_SETTINGS_KEY } from '../teamColumnCount';

describe('teamColumnCount', () => {
  it('exports the teams settings key', () => {
    expect(TEAMS_SETTINGS_KEY).toBe('teams');
  });
});

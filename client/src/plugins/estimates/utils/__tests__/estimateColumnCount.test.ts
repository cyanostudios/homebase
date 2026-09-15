import { ESTIMATES_SETTINGS_KEY } from '../estimateColumnCount';

describe('estimateColumnCount', () => {
  it('exports the estimates settings key', () => {
    expect(ESTIMATES_SETTINGS_KEY).toBe('estimates');
  });
});

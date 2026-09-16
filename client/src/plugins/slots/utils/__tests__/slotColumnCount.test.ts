import { SLOTS_SETTINGS_KEY } from '../slotColumnCount';

describe('slotColumnCount', () => {
  it('exports the slots settings key', () => {
    expect(SLOTS_SETTINGS_KEY).toBe('slots');
  });
});

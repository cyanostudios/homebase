import { NOTES_SETTINGS_KEY } from '../noteColumnCount';

describe('noteColumnCount', () => {
  it('exports the notes settings key', () => {
    expect(NOTES_SETTINGS_KEY).toBe('notes');
  });
});

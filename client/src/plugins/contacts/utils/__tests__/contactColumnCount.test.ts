import { CONTACTS_SETTINGS_KEY } from '../contactColumnCount';

describe('contactColumnCount', () => {
  it('exports the contacts settings key', () => {
    expect(CONTACTS_SETTINGS_KEY).toBe('contacts');
  });
});

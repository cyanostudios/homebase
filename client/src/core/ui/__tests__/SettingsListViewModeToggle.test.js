const fs = require('fs');
const path = require('path');

const toggleSrc = fs.readFileSync(
  path.join(__dirname, '../SettingsListViewModeToggle.tsx'),
  'utf8',
);

describe('SettingsListViewModeToggle', () => {
  test('uses shared list-layout shell and cards/table i18n labels', () => {
    expect(toggleSrc).toMatch(/LIST_LAYOUT_TOGGLE_SHELL_CLASS/);
    expect(toggleSrc).toMatch(/common\.cardsView/);
    expect(toggleSrc).toMatch(/common\.tableView/);
    expect(toggleSrc).toMatch(/onChange\('cards'\)/);
    expect(toggleSrc).toMatch(/onChange\('table'\)/);
  });
});

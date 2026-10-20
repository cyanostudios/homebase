const fs = require('fs');
const path = require('path');

const toggleSrc = fs.readFileSync(path.join(__dirname, '../ListTagsChipsToggle.tsx'), 'utf8');

describe('ListTagsChipsToggle wiring', () => {
  test('toggle is a pressed button with Tag icon chrome', () => {
    expect(toggleSrc).toMatch(/aria-pressed=\{visible\}/);
    expect(toggleSrc).toMatch(/Tag/);
    expect(toggleSrc).toMatch(/common\.tags/);
    expect(toggleSrc).toMatch(/common\.showTags/);
    expect(toggleSrc).toMatch(/common\.hideTags/);
    expect(toggleSrc).toMatch(/LIST_FILTER_CHIPS_TOGGLE_CLASS/);
    expect(toggleSrc).toMatch(/LIST_FILTER_CHIPS_TOGGLE_OFF_CLASS/);
    expect(toggleSrc).toMatch(/hasActiveSelection/);
    expect(toggleSrc).toMatch(/data-has-active-selection/);
    expect(toggleSrc).toMatch(/common\.activeSelection/);
    expect(toggleSrc).toMatch(/ListChipsToggleActivePip/);
  });
});

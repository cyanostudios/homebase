const fs = require('fs');
const path = require('path');

const toggleSrc = fs.readFileSync(path.join(__dirname, '../ListFilterChipsToggle.tsx'), 'utf8');
const hookSrc = fs.readFileSync(path.join(__dirname, '../usePersistedFiltersVisible.ts'), 'utf8');

describe('ListFilterChipsToggle wiring', () => {
  test('toggle is a pressed button with Filter icon chrome', () => {
    expect(toggleSrc).toMatch(/aria-pressed=\{visible\}/);
    expect(toggleSrc).toMatch(/ListFilter/);
    expect(toggleSrc).toMatch(/common\.filters/);
    expect(toggleSrc).toMatch(/common\.showFilters/);
    expect(toggleSrc).toMatch(/common\.hideFilters/);
    expect(toggleSrc).toMatch(/LIST_FILTER_CHIPS_TOGGLE_CLASS/);
    expect(toggleSrc).toMatch(/LIST_FILTER_CHIPS_TOGGLE_OFF_CLASS/);
  });

  test('visibility preference persists to localStorage', () => {
    expect(hookSrc).toMatch(/localStorage\.getItem/);
    expect(hookSrc).toMatch(/localStorage\.setItem/);
    expect(hookSrc).toMatch(/defaultVisible = true/);
  });
});

const fs = require('fs');
const path = require('path');

const { getNextListItemIndex, collectNavigableListItems } = require('../keyboardHandlers');

const handlerSrc = fs.readFileSync(path.join(__dirname, '../keyboardHandlers.ts'), 'utf8');
const tableSrc = fs.readFileSync(path.join(__dirname, '../../ui/SortableListTable.tsx'), 'utf8');

describe('list keyboard navigation helpers', () => {
  test('getNextListItemIndex wraps around', () => {
    expect(getNextListItemIndex(0, 3, -1)).toBe(2);
    expect(getNextListItemIndex(2, 3, 1)).toBe(0);
    expect(getNextListItemIndex(1, 3, 1)).toBe(2);
    expect(getNextListItemIndex(1, 3, -1)).toBe(0);
  });

  test('getNextListItemIndex returns -1 for empty or unknown current', () => {
    expect(getNextListItemIndex(0, 0, 1)).toBe(-1);
    expect(getNextListItemIndex(-1, 3, 1)).toBe(-1);
  });
});

describe('list keyboard navigation wiring', () => {
  test('arrow handler navigates any data-list-item, not only table rows', () => {
    expect(handlerSrc).toMatch(/collectNavigableListItems/);
    expect(handlerSrc).toMatch(/ArrowUp/);
    expect(handlerSrc).toMatch(/ArrowDown/);
    expect(handlerSrc).toMatch(/scrollIntoView/);
    expect(handlerSrc).not.toMatch(
      /Only handle if we're focused on a table row with list item data/,
    );
  });

  test('collectNavigableListItems scopes table rows to the table', () => {
    expect(handlerSrc).toMatch(/closest\('table'\)/);
    expect(handlerSrc).toMatch(/tr\[data-list-item\]/);
  });

  test('collectNavigableListItems finds card siblings by nearest multi-item ancestor', () => {
    expect(handlerSrc).toMatch(/querySelectorAll<HTMLElement>\('\[data-list-item\]'\)/);
    expect(handlerSrc).toMatch(/items\.length > 1/);
  });

  test('Space on a list item activates the row (quick context), not openForView', () => {
    expect(handlerSrc).toMatch(/focusedElement\.click\(\)/);
    expect(handlerSrc).toMatch(/dataset\.listItem/);
    expect(handlerSrc).not.toMatch(/openForViewFunction/);
    expect(handlerSrc).not.toMatch(/findOpenFunction/);
  });

  test('SortableListTable rows are focusable for keyboard nav when clickable', () => {
    expect(tableSrc).toMatch(/tabIndex=\{onRowClick \? 0 : undefined\}/);
    expect(tableSrc).toMatch(/focus:ring-2/);
    expect(tableSrc).toMatch(/data-list-item=/);
  });
});

describe('collectNavigableListItems without DOM', () => {
  test('export is a function', () => {
    expect(typeof collectNavigableListItems).toBe('function');
  });
});

const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '../DetailSection.tsx'), 'utf8');
const en = fs.readFileSync(path.join(__dirname, '../../../i18n/locales/en.json'), 'utf8');
const sv = fs.readFileSync(path.join(__dirname, '../../../i18n/locales/sv.json'), 'utf8');

describe('DetailSection collapsible', () => {
  test('supports optional collapsible with default collapsed state', () => {
    expect(src).toMatch(/collapsible\s*=\s*false/);
    expect(src).toMatch(/defaultOpen\s*=\s*false/);
    expect(src).toMatch(/from '@\/components\/ui\/collapsible'/);
    expect(src).toMatch(/<Collapsible\s+open=\{open\}\s+onOpenChange=\{setOpen\}/);
    expect(src).toMatch(/<CollapsibleTrigger/);
    expect(src).toMatch(/<CollapsibleContent>/);
  });

  test('keeps action outside the expand trigger', () => {
    const triggerBlock = src.slice(
      src.indexOf('<CollapsibleTrigger'),
      src.indexOf('</CollapsibleTrigger>'),
    );
    expect(triggerBlock).not.toMatch(/\baction\b/);
    expect(src).toMatch(/e\.stopPropagation\(\)/);
  });

  test('exposes expand/collapse aria labels in en and sv', () => {
    expect(src).toMatch(/common\.expandSection/);
    expect(src).toMatch(/common\.collapseSection/);
    expect(en).toMatch(/"expandSection":\s*"Expand section"/);
    expect(en).toMatch(/"collapseSection":\s*"Collapse section"/);
    expect(sv).toMatch(/"expandSection":\s*"Visa sektion"/);
    expect(sv).toMatch(/"collapseSection":\s*"Dölj sektion"/);
  });
});

const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '../DetailActivityLog.tsx'), 'utf8');
const en = fs.readFileSync(path.join(__dirname, '../../../i18n/locales/en.json'), 'utf8');
const sv = fs.readFileSync(path.join(__dirname, '../../../i18n/locales/sv.json'), 'utf8');

describe('DetailActivityLog collapsible', () => {
  test('uses Collapsible with default collapsed state', () => {
    expect(src).toMatch(/from '@\/components\/ui\/collapsible'/);
    expect(src).toMatch(/useState\(false\)/);
    expect(src).toMatch(/<Collapsible\s+open=\{open\}\s+onOpenChange=\{setOpen\}/);
    expect(src).toMatch(/<CollapsibleTrigger/);
    expect(src).toMatch(/<CollapsibleContent>/);
  });

  test('keeps reset action outside the expand trigger', () => {
    const triggerBlock = src.slice(
      src.indexOf('<CollapsibleTrigger'),
      src.indexOf('</CollapsibleTrigger>'),
    );
    expect(triggerBlock).not.toMatch(/activityLog\.reset/);
    expect(src).toMatch(/showClearButton \? \(/);
    expect(src).toMatch(/e\.stopPropagation\(\)/);
  });

  test('exposes expand/collapse aria labels in en and sv', () => {
    expect(src).toMatch(/activityLog\.expand/);
    expect(src).toMatch(/activityLog\.collapse/);
    expect(en).toMatch(/"expand":\s*"Expand activity"/);
    expect(en).toMatch(/"collapse":\s*"Collapse activity"/);
    expect(sv).toMatch(/"expand":\s*"Visa aktivitet"/);
    expect(sv).toMatch(/"collapse":\s*"Dölj aktivitet"/);
  });
});

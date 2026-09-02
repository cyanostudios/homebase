const fs = require('fs');
const path = require('path');

const hookSrc = fs.readFileSync(path.join(__dirname, '../useQuickContextPreview.ts'), 'utf8');

describe('useQuickContextPreview activateRow toggle', () => {
  test('same desktop row again clears preview (Space / click close)', () => {
    expect(hookSrc).toMatch(
      /setPreviewItem\(\(current\) => \(current && getItemId\(current\) === getItemId\(item\) \? null : item\)\)/,
    );
  });

  test('compact viewport still opens full view', () => {
    expect(hookSrc).toMatch(/isCompactViewport/);
    expect(hookSrc).toMatch(/markPendingAndOpen\(item, \(\) => openForView\(item\)\)/);
  });
});

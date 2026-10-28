const fs = require('fs');
const path = require('path');

const emptySrc = fs.readFileSync(path.join(__dirname, '../ListTagsEmptyRow.tsx'), 'utf8');

describe('ListTagsEmptyRow wiring', () => {
  test('points users to Settings to create the first tag', () => {
    expect(emptySrc).toMatch(/common\.tagsEmptyHint/);
    expect(emptySrc).toMatch(/common\.addTagsInSettings/);
    expect(emptySrc).toMatch(/onOpenSettings/);
    expect(emptySrc).toMatch(/Settings/);
  });
});

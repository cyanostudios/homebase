const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '../InstructionListItem.tsx'), 'utf8');

describe('InstructionListItem reorder layout', () => {
  test('places up/down arrows horizontally, after status select', () => {
    expect(src).toMatch(/className="flex flex-row items-center gap-0\.5"/);
    expect(src).not.toMatch(/className="flex flex-col gap-0\.5"/);

    const statusIdx = src.indexOf('{onStatusChange ? (');
    const reorderIdx = src.indexOf('{canReorder ? (');
    expect(statusIdx).toBeGreaterThan(-1);
    expect(reorderIdx).toBeGreaterThan(-1);
    expect(statusIdx).toBeLessThan(reorderIdx);
  });
});

const fs = require('fs');
const path = require('path');

const menusSrc = fs.readFileSync(path.join(__dirname, '../InventoryDetailHeaderMenus.tsx'), 'utf8');
const viewSrc = fs.readFileSync(path.join(__dirname, '../InventoryView.tsx'), 'utf8');

describe('InventoryDetailHeaderMenus duplicate action', () => {
  test('Actions menu includes duplicate wired like price lists', () => {
    expect(menusSrc).toMatch(/getInventoryDuplicateConfig/);
    expect(menusSrc).toMatch(/executeInventoryDuplicate/);
    expect(menusSrc).toMatch(/DuplicateDialog/);
    expect(menusSrc).toMatch(/id: 'duplicate'/);
    expect(menusSrc).toMatch(/common\.duplicate/);
    expect(menusSrc).toMatch(/setRecentlyDuplicatedInventoryId/);
  });

  test('view mounts InventoryDetailHeaderMenus in header', () => {
    expect(viewSrc).toMatch(/InventoryDetailHeaderMenus/);
  });
});

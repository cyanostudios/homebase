const fs = require('fs');
const path = require('path');

const listSrc = fs.readFileSync(path.join(__dirname, '../InventoryList.tsx'), 'utf8');
const tableSrc = fs.readFileSync(path.join(__dirname, '../InventoryListTable.tsx'), 'utf8');

describe('Clubdesk InventoryList table view wiring', () => {
  test('list renders InventoryListTable', () => {
    expect(listSrc).toMatch(/InventoryListTable/);
  });

  test('list uses inventory domain mail layout', () => {
    expect(listSrc).toMatch(/activeDomain === 'inventory'/);
    expect(listSrc).toMatch(/InventoryView/);
    expect(listSrc).toMatch(/InventoryForm/);
  });

  test('table uses clubdesk inventory nav icon title', () => {
    expect(tableSrc).toMatch(/nav\.clubdesk-inventory/);
  });

  test('list wires inventory settings gear to ClubdeskInventorySettingsView', () => {
    expect(listSrc).toMatch(/ClubdeskInventorySettingsView/);
    expect(listSrc).toMatch(/openInventorySettings/);
    expect(listSrc).toMatch(/Settings/);
    expect(listSrc).toMatch(/onSettings/);
  });
});

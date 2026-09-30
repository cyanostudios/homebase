const fs = require('fs');
const path = require('path');

const listSrc = fs.readFileSync(path.join(__dirname, '../InventoryList.tsx'), 'utf8');
const tableSrc = fs.readFileSync(path.join(__dirname, '../InventoryListTable.tsx'), 'utf8');
const viewSrc = fs.readFileSync(path.join(__dirname, '../InventoryView.tsx'), 'utf8');
const pickerSrc = fs.readFileSync(path.join(__dirname, '../PriceListItemsEditor.tsx'), 'utf8');

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

  test('meta row shows publication status', () => {
    expect(tableSrc).toMatch(/clubdesk\.status\.published/);
    expect(tableSrc).toMatch(/clubdesk\.status\.draft/);
  });

  test('list meta includes optional kiosk category and package', () => {
    expect(tableSrc).toMatch(/formatInventoryPackageSize/);
    expect(tableSrc).toMatch(/item\.category/);
  });

  test('price list picker uses kiosk meta and search helpers', () => {
    expect(pickerSrc).toMatch(/formatInventoryPickerSecondaryMeta/);
    expect(pickerSrc).toMatch(/inventoryMatchesPickerSearch/);
  });

  test('inventory view omits empty kiosk product facts groups', () => {
    expect(viewSrc).toMatch(/productFactRows\.length > 0/);
    expect(viewSrc).toMatch(/hasIngredientsGroup/);
    expect(viewSrc).toMatch(/provenanceParts\.length > 0/);
  });

  test('list wires inventory settings gear to ClubdeskInventorySettingsView', () => {
    expect(listSrc).toMatch(/ClubdeskInventorySettingsView/);
    expect(listSrc).toMatch(/openInventorySettings/);
    expect(listSrc).toMatch(/Settings/);
    expect(listSrc).toMatch(/onSettings/);
  });

  test('inventory tags settings key is allowlisted clubdesk category', () => {
    const keySrc = fs.readFileSync(
      path.join(__dirname, '../../utils/clubdeskInventorySettingsKey.ts'),
      'utf8',
    );
    const allowlistSrc = fs.readFileSync(
      path.join(__dirname, '../../../../../../plugins/settings/settingsCategories.js'),
      'utf8',
    );
    expect(keySrc).toMatch(/CLUBDESK_INVENTORY_SETTINGS_KEY = 'clubdesk'/);
    expect(allowlistSrc).toMatch(/'clubdesk'/);
    expect(keySrc).not.toMatch(/clubdesk-inventory/);
  });
});

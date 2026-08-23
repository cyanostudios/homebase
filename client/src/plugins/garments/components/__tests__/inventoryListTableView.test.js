const fs = require('fs');
const path = require('path');

const listSrc = fs.readFileSync(path.join(__dirname, '../GarmentList.tsx'), 'utf8');
const tableSrc = fs.readFileSync(path.join(__dirname, '../InventoryListTable.tsx'), 'utf8');
const itemSrc = fs.readFileSync(path.join(__dirname, '../InventoryListItem.tsx'), 'utf8');
const panelSrc = fs.readFileSync(path.join(__dirname, '../InventoryQuickContextPanel.tsx'), 'utf8');
const formSrc = fs.readFileSync(path.join(__dirname, '../GarmentForm.tsx'), 'utf8');

describe('Garment inventory list split view wiring', () => {
  test('inventory list previews items on wide screens without opening the global panel', () => {
    expect(listSrc).toMatch(/useQuickContextPreview/);
    expect(listSrc).toMatch(/storeKey: 'garments-inventory'/);
    expect(listSrc).toMatch(/InventoryQuickContextPanel/);
    expect(listSrc).toMatch(/handleRowActivate/);
    expect(listSrc).toMatch(/handleOpenInventoryForView/);
    expect(listSrc).toMatch(/w-\[min\(100%,36rem\)\]/);
    expect(tableSrc).toMatch(/activeInventoryId/);
    expect(tableSrc).toMatch(/selectionEnabled/);
    expect(itemSrc).toMatch(/active\?: boolean/);
    expect(itemSrc).toMatch(/highlighted\?: boolean/);
    expect(itemSrc).toMatch(/aria-current=\{active \? 'true' : undefined\}/);
    expect(listSrc).toMatch(/recentlyDuplicatedInventoryId/);
    expect(tableSrc).toMatch(/recentlyDuplicatedInventoryId/);
  });

  test('quick context and form support variants with editable quantity', () => {
    expect(panelSrc).toMatch(/variant = 'list'/);
    expect(panelSrc).toMatch(/garments\.quickContext\.openFullProfile/);
    expect(panelSrc).toMatch(/DETAIL_NOTE_CALLOUT_CLASS/);
    expect(panelSrc).toMatch(/garments\.brand/);
    expect(panelSrc).toMatch(/garments\.variants/);
    expect(panelSrc).toMatch(/garments\.totalQuantity/);
    expect(panelSrc).toMatch(/onVariantQuantityChange/);
    expect(panelSrc).toMatch(/decreaseQuantity/);
    expect(panelSrc).toMatch(/increaseQuantity/);
    expect(listSrc).toMatch(/updateInventoryVariantQuantity/);
    expect(listSrc).toMatch(/onVariantQuantityChange=/);
    expect(formSrc).toMatch(/addVariant/);
    expect(formSrc).toMatch(/buildDuplicatedVariantPayload/);
    expect(formSrc).toMatch(/duplicateVariant/);
    expect(formSrc).toMatch(/removeVariant/);
    expect(formSrc).toMatch(/pendingDeleteVariantIndex/);
    expect(formSrc).toMatch(/deleteVariantConfirm/);
    expect(formSrc).toMatch(/garments\.variants/);
    expect(tableSrc).toMatch(/totalQuantity/);
    expect(tableSrc).toMatch(/variantCount/);
  });

  test('provider clears duplicate highlight on all open helpers and uses shared validation', () => {
    const providerSrc = fs.readFileSync(
      path.join(__dirname, '../../context/GarmentProvider.tsx'),
      'utf8',
    );
    expect(providerSrc).toMatch(/validateInventoryPayload/);
    expect(providerSrc).toMatch(/buildDuplicatedItemVariantPayloads/);
    expect(providerSrc).toMatch(/usePluginNavigation/);
    const openHelperClears = providerSrc.match(/setRecentlyDuplicatedInventoryId\(null\)/g);
    expect(openHelperClears && openHelperClears.length).toBeGreaterThanOrEqual(6);
  });
});

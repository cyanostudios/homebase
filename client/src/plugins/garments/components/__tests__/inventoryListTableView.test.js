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
    expect(listSrc).toMatch(/lg:grid-cols-2/);
    expect(listSrc).toMatch(/lg:sticky lg:top-4/);
    expect(listSrc).toMatch(/PLUGIN_PAGE_LIST_SHELL_CLASS/);
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
    expect(panelSrc).toMatch(/QuickContextOpenFullFooter/);
    expect(panelSrc).toMatch(/DETAIL_NOTE_CALLOUT_CLASS/);
    expect(panelSrc).toMatch(/garments\.brand/);
    expect(panelSrc).toMatch(/garments\.variants/);
    expect(panelSrc).toMatch(/garments\.totalQuantity/);
    expect(panelSrc).toMatch(/onVariantQuantityChange/);
    expect(panelSrc).toMatch(/decreaseQuantity/);
    expect(panelSrc).toMatch(/increaseQuantity/);
    expect(panelSrc).toMatch(/assignedLists\.length > 0/);
    expect(panelSrc).not.toMatch(/notInAnyList/);
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
    expect(tableSrc).toMatch(/visibleColumnIds/);
    expect(listSrc).toMatch(/resolveVisibleInventoryTableColumns/);
    expect(listSrc).toMatch(/visibleColumnIds=\{visibleColumnIds\}/);
  });

  test('inventory bulk select supports list visibility like contacts assignable', () => {
    expect(listSrc).toMatch(/BulkActionRoundBar/);
    expect(listSrc).toMatch(/InventoryBulkListsDialog/);
    expect(listSrc).toMatch(/bulkListsAction/);
    expect(listSrc).toMatch(/assignInventoryItemToList/);
    expect(listSrc).toMatch(/unassignInventoryItemFromList/);
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

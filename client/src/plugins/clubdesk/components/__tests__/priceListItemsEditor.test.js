const fs = require('fs');
const path = require('path');

const formSrc = fs.readFileSync(path.join(__dirname, '../PriceListForm.tsx'), 'utf8');
const editorSrc = fs.readFileSync(path.join(__dirname, '../PriceListItemsEditor.tsx'), 'utf8');

describe('PriceListItemsEditor wiring', () => {
  test('form uses PriceListItemsEditor and renumbers within categories on remove', () => {
    expect(formSrc).toMatch(/PriceListItemsEditor/);
    expect(formSrc).toMatch(/renumberWithinCategories/);
    expect(formSrc).toMatch(/duplicatedItemIndexes/);
    expect(formSrc).toMatch(/clientKey: newClientKey/);
    expect(formSrc).toMatch(
      /const copyItem = \(index: number\) => \{\s*setFormData\(\(prev\) => \{[\s\S]*?\}\);\s*setDuplicatedItemIndexes\(new Set\(\[index \+ 1\]\)\)/,
    );
    expect(formSrc).toMatch(/renumberWithinCategories\(\[emptyItem\(1\), \.\.\.prev\.items\]\)/);
    expect(formSrc).toMatch(
      /const addItem = \(\) => \{[\s\S]*?setDuplicatedItemIndexes\(new Set\(\[0\]\)\)/,
    );
    expect(formSrc).not.toMatch(/aria-label=\{t\('clubdesk\.priceList\.removeItem'\)\}/);
  });

  test('editor uses compact invoice-like chrome, round actions, and delete confirm', () => {
    expect(editorSrc).toMatch(/RoundIconLabelButton/);
    expect(editorSrc).toMatch(/ConfirmDialog/);
    expect(editorSrc).toMatch(/LINE_ITEM_EDIT_ROW_CLASS/);
    expect(editorSrc).toMatch(/PRICE_LIST_ITEM_EDIT_GRID_CLASS/);
    expect(editorSrc).toMatch(/PRICE_LIST_ITEM_STACK_CLASS/);
    expect(editorSrc).toMatch(/PRICE_LIST_ITEM_PRICE_CATEGORY_ROW_CLASS/);
    expect(editorSrc).toMatch(/rows=\{2\}/);
    expect(editorSrc).toMatch(/canReorderItemWithinCategory/);
    expect(editorSrc).toMatch(/removeItemConfirm/);
    expect(editorSrc).toMatch(/item\.clientKey/);
    expect(editorSrc).toMatch(/pendingDeleteIndex !== null/);
    expect(editorSrc).toMatch(/\(item\.price \?\? 0\) !== 0/);
    expect(editorSrc).toMatch(/inventoryPrice/);
    expect(editorSrc).toMatch(/listPrice/);
    expect(editorSrc).toMatch(/priceOverride/);
    expect(editorSrc).toMatch(/inventoryCatalogPrice/);
    expect(editorSrc).toMatch(/linkInventory/);
    expect(editorSrc).toMatch(/unlinkInventory[\s\S]*?PRICE_LIST_UNLINK_CONTENT_CLASS/);
    expect(editorSrc).toMatch(/removeItem[\s\S]*?BULK_ACTION_DESTRUCTIVE_CONTENT_CLASS/);
    expect(editorSrc).toMatch(/buildInventoryLinkPatch/);
    expect(editorSrc).toMatch(/clearInventoryLinkPatch/);
    expect(editorSrc).toMatch(/SelectContent className="z-\[130\]"/);
    // Bulk unlink/delete live on DetailSection action (items heading row)
    expect(formSrc).toMatch(/action=\{/);
    expect(formSrc).toMatch(/addItem/);
    expect(formSrc).toMatch(/unlinkAll/);
    expect(formSrc).toMatch(/deleteAll/);
    expect(formSrc).toMatch(/pendingBulkAction/);
    expect(formSrc).toMatch(/PRICE_LIST_UNLINK_CONTENT_CLASS/);
    expect(formSrc).toMatch(/BULK_ACTION_DESTRUCTIVE_CONTENT_CLASS/);
    expect(formSrc).toMatch(/unlinkAllItems/);
    expect(formSrc).toMatch(/removeAllItems/);
    expect(formSrc).toMatch(/clearInventoryLinkPatch/);
    expect(formSrc).toMatch(/syncPriceListItemsWithInventoryCatalog/);
  });
});

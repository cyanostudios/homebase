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
    expect(formSrc).not.toMatch(/aria-label=\{t\('clubdesk\.priceList\.removeItem'\)\}/);
  });

  test('editor uses compact invoice-like chrome, round actions, and delete confirm', () => {
    expect(editorSrc).toMatch(/RoundIconLabelButton/);
    expect(editorSrc).toMatch(/ConfirmDialog/);
    expect(editorSrc).toMatch(/LINE_ITEM_EDIT_ROW_CLASS/);
    expect(editorSrc).toMatch(/PRICE_LIST_ITEM_EDIT_GRID_CLASS/);
    expect(editorSrc).toMatch(/PRICE_LIST_ITEM_STACK_CLASS/);
    expect(editorSrc).toMatch(/canReorderItemWithinCategory/);
    expect(editorSrc).toMatch(/removeItemConfirm/);
    expect(editorSrc).toMatch(/dangerSoft/);
    expect(editorSrc).toMatch(/item\.clientKey/);
    expect(editorSrc).toMatch(/pendingDeleteIndex !== null/);
    expect(editorSrc).toMatch(/\(item\.price \?\? 0\) !== 0/);
  });
});

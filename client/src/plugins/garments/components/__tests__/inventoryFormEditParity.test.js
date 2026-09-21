const fs = require('fs');
const path = require('path');

const panelSrc = fs.readFileSync(path.join(__dirname, '../InventoryQuickContextPanel.tsx'), 'utf8');
const formSrc = fs.readFileSync(path.join(__dirname, '../GarmentForm.tsx'), 'utf8');

describe('Garments inventory view/edit tab shell parity', () => {
  test('view uses URL ?tab= with four chips matching edit', () => {
    expect(panelSrc).toMatch(/useSearchParams/);
    expect(panelSrc).toMatch(/parseInventoryViewTab/);
    expect(panelSrc).toMatch(/'information'/);
    expect(panelSrc).toMatch(/value === 'properties'/);
    expect(panelSrc).not.toMatch(/id: 'properties'/);
    expect(panelSrc).toMatch(/'variants'/);
    expect(panelSrc).toMatch(/'lists'/);
    expect(panelSrc).toMatch(/'activity'/);
    expect(panelSrc).toMatch(/next\.delete\('tab'\)/);
    expect(panelSrc).toMatch(/LIST_FILTER_CHIP_ROW_CLASS/);
    expect(panelSrc).toMatch(/DetailActivityLog/);
    expect(panelSrc).toMatch(/DetailHeaderMetaRow/);
  });

  test('edit uses same URL ?tab= shell; activity greyed', () => {
    expect(formSrc).toMatch(/useSearchParams/);
    expect(formSrc).toMatch(/parseInventoryFormTab/);
    expect(formSrc).toMatch(/INVENTORY_FORM_EDIT_DISABLED_TABS/);
    expect(formSrc).toMatch(/opacity-40/);
    expect(formSrc).toMatch(/disabled=\{isDisabled\}/);
    expect(formSrc).toMatch(/activeTab === 'information'/);
    expect(formSrc).not.toMatch(/activeTab === 'properties'/);
    expect(formSrc).toMatch(/activeTab === 'information' \? inventoryPropertiesCard/);
    expect(formSrc).toMatch(/activeTab === 'variants'/);
    expect(formSrc).toMatch(/activeTab === 'lists'/);
    expect(formSrc).not.toMatch(/leftSidebar/);
  });

  test('edit keeps session leave and ghost facts', () => {
    expect(formSrc).toMatch(/registerUnsavedChangesChecker\(formKey, \(\) => true\)/);
    expect(formSrc).toMatch(/force:\s*true/);
    expect(formSrc).toMatch(/FORM_GHOST_INPUT_CLASS/);
  });

  test('discard confirms close without setTimeout race', () => {
    expect(formSrc).toMatch(/confirmDiscard\(\);/);
    expect(formSrc).not.toMatch(/setTimeout\(\(\) => confirmDiscard/);
    // pendingAction is already onCancel — avoid double-invoke (edit→view then close)
    expect(formSrc).not.toMatch(/confirmDiscard\(\);\s*\n\s*onCancel\(\);/);
  });
});

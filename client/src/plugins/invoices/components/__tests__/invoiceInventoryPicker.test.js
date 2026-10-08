const fs = require('fs');
const path = require('path');

const editorSrc = fs.readFileSync(path.join(__dirname, '../InvoiceLineItemsEditor.tsx'), 'utf8');
const garmentsSettingsSrc = fs.readFileSync(
  path.join(__dirname, '../../../garments/components/GarmentsInventorySettingsView.tsx'),
  'utf8',
);
const clubdeskSettingsSrc = fs.readFileSync(
  path.join(__dirname, '../../../clubdesk/components/ClubdeskInventorySettingsView.tsx'),
  'utf8',
);

describe('invoice inventory picker wiring', () => {
  test('line editor hides inventory button unless sources and handler', () => {
    expect(editorSrc).toMatch(/useInvoiceInventorySources/);
    expect(editorSrc).toMatch(/onAddFromInventory && inventorySources\.length > 0/);
    expect(editorSrc).toMatch(/InvoiceInventoryPicker/);
    const pickerSrc = fs.readFileSync(
      path.join(__dirname, '../InvoiceInventoryPicker.tsx'),
      'utf8',
    );
    expect(pickerSrc).toMatch(/invoices\.addFromInventory/);
    expect(pickerSrc).toMatch(/garmentsApi\.getInventory/);
    expect(pickerSrc).toMatch(/clubdeskApi\.getInventoryItems/);
  });

  test('garments inventory settings gate invoicing category', () => {
    expect(garmentsSettingsSrc).toMatch(/hasInventoryInvoicingPlugins/);
    expect(garmentsSettingsSrc).toMatch(/id: 'invoicing'/);
    expect(garmentsSettingsSrc).toMatch(/invoicable/);
  });

  test('clubdesk inventory settings gate invoicing category after tags', () => {
    expect(clubdeskSettingsSrc).toMatch(/hasInventoryInvoicingPlugins/);
    expect(clubdeskSettingsSrc).toMatch(/id: 'invoicing'/);
    const tagsIdx = clubdeskSettingsSrc.indexOf("id: 'tags'");
    const invoicingIdx = clubdeskSettingsSrc.indexOf("id: 'invoicing'");
    const importIdx = clubdeskSettingsSrc.indexOf("id: 'import'");
    expect(tagsIdx).toBeGreaterThan(-1);
    expect(invoicingIdx).toBeGreaterThan(tagsIdx);
    expect(importIdx).toBeGreaterThan(invoicingIdx);
  });
});

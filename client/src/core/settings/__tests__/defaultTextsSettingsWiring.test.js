const fs = require('fs');
const path = require('path');

const listSrc = fs.readFileSync(
  path.join(__dirname, '../../../plugins/settings/components/SettingsList.tsx'),
  'utf8',
);
const formSrc = fs.readFileSync(
  path.join(__dirname, '../../ui/SettingsForms/DefaultTextsSettingsForm.tsx'),
  'utf8',
);

describe('Settings Default texts plugin gate wiring', () => {
  test('SettingsList gates default-texts category on invoices/estimates plugins', () => {
    expect(listSrc).toMatch(/useEnabledPlugins/);
    expect(listSrc).toMatch(/hasDefaultTextsPlugins/);
    expect(listSrc).toMatch(/default-texts/);
    expect(listSrc).toMatch(/setSelectedCategory\('preferences'\)/);
  });

  test('DefaultTextsSettingsForm gates invoice and estimate sections on plugins', () => {
    expect(formSrc).toMatch(/useEnabledPlugins/);
    expect(formSrc).toMatch(/showDefaultTextsInvoiceMail/);
    expect(formSrc).toMatch(/showDefaultTextsEstimateMail/);
    expect(formSrc).toMatch(/showInvoiceMail/);
    expect(formSrc).toMatch(/showEstimateMail/);
  });
});

const fs = require('fs');
const path = require('path');

const routingSrc = fs.readFileSync(path.join(__dirname, '../PulseProvidersRouting.tsx'), 'utf8');
const listSrc = fs.readFileSync(path.join(__dirname, '../PulseProvidersList.tsx'), 'utf8');

describe('PulseProvidersRouting settings shell', () => {
  test('uses PluginSettingsPageShell with RoundIconLabelButton categories (Contacts settings pattern)', () => {
    expect(routingSrc).toMatch(/PluginSettingsPageShell/);
    expect(routingSrc).toMatch(/SettingsHeaderSaveButton/);
    expect(routingSrc).toMatch(/SETTINGS_CATEGORY_ICONS/);
    expect(routingSrc).toMatch(/categories=\{categories\}/);
    expect(routingSrc).toMatch(/activeCategory=\{activeCategory\}/);
    expect(routingSrc).toMatch(/onClose=\{handleClose\}/);
    expect(routingSrc).toMatch(/id: 'global'/);
    expect(routingSrc).toMatch(/id: 'plugins'/);
    expect(routingSrc).toMatch(/activeCategory === 'global'/);
    expect(routingSrc).toMatch(/activeCategory === 'plugins'/);
    expect(routingSrc).not.toMatch(/LIST_FILTER_CHIP/);
    expect(routingSrc).not.toMatch(/PLUGIN_PAGE_TITLE_CLASS/);
  });

  test('list mounts routing in Contacts settings page shell (bg + padding)', () => {
    expect(listSrc).toMatch(/pulsesContentView === 'routing'/);
    expect(listSrc).toMatch(
      /plugin-pulses flex min-h-0 flex-1 flex-col overflow-y-auto bg-background/,
    );
    expect(listSrc).toMatch(/px-4 py-4 md:px-6/);
    expect(listSrc).toMatch(/selectedCategory=\{routingCategory\}/);
    expect(listSrc).toMatch(/onClose=\{closeRoutingView\}/);
    expect(listSrc).not.toMatch(/renderCategoryButtonsInline/);
    expect(routingSrc).not.toMatch(/renderCategoryButtonsInline/);
  });
});

const fs = require('fs');
const path = require('path');

const routingSrc = fs.readFileSync(path.join(__dirname, '../MailProvidersRouting.tsx'), 'utf8');
const listSrc = fs.readFileSync(path.join(__dirname, '../MailProvidersList.tsx'), 'utf8');

describe('MailProvidersRouting settings shell', () => {
  test('uses PluginSettingsPageShell with stacked global + per-plugin cards (no category tabs)', () => {
    expect(routingSrc).toMatch(/PluginSettingsPageShell/);
    expect(routingSrc).toMatch(/wrapContentInCard=\{false\}/);
    expect(routingSrc).toMatch(/categories=\{\[\]\}/);
    expect(routingSrc).toMatch(/DETAIL_VIEW_CARD_CLASS/);
    expect(routingSrc).toMatch(/mail\.routing\.globalTitle/);
    expect(routingSrc).toMatch(/mail\.routing\.pluginsTitle/);
    expect(routingSrc).toMatch(/icon=\{Sparkles\}/);
    expect(routingSrc).toMatch(/icon=\{Route\}/);
    expect(routingSrc).toMatch(/iconPlugin="mail"/);
    expect(routingSrc).toMatch(/subtleTitle/);
    expect(routingSrc).toMatch(/RoundIconLabelButton/);
    expect(routingSrc).toMatch(/variant="success"/);
    expect(routingSrc).not.toMatch(/activeCategory/);
    expect(routingSrc).not.toMatch(/SETTINGS_CATEGORY_ICONS/);
    expect(routingSrc).not.toMatch(/SettingsHeaderSaveButton/);
    expect(routingSrc).not.toMatch(/LIST_FILTER_CHIP/);
    expect(routingSrc).not.toMatch(/PLUGIN_PAGE_TITLE_CLASS/);
  });

  test('list mounts routing in Contacts settings page shell (bg + padding)', () => {
    expect(listSrc).toMatch(/mailContentView === 'routing'/);
    expect(listSrc).toMatch(
      /plugin-mail flex min-h-0 flex-1 flex-col overflow-y-auto bg-background/,
    );
    expect(listSrc).toMatch(/px-4 py-4 md:px-6/);
    expect(listSrc).toMatch(/onClose=\{closeRoutingView\}/);
    expect(listSrc).not.toMatch(/selectedCategory/);
    expect(listSrc).not.toMatch(/routingCategory/);
    expect(listSrc).not.toMatch(/renderCategoryButtonsInline/);
    expect(routingSrc).not.toMatch(/renderCategoryButtonsInline/);
  });

  test('per-plugin list uses compact invoice-style rows', () => {
    expect(routingSrc).toMatch(/PLUGIN_ROUTING_ROW_CLASS/);
    expect(routingSrc).toMatch(/FORM_COMPACT_SELECT_CLASS/);
    expect(routingSrc).toMatch(/alwaysExpanded/);
    expect(routingSrc).not.toMatch(/<Table/);
  });
});

const fs = require('fs');
const path = require('path');

const historySrc = fs.readFileSync(path.join(__dirname, '../PulseHistoryView.tsx'), 'utf8');
const listSrc = fs.readFileSync(path.join(__dirname, '../PulseList.tsx'), 'utf8');

describe('PulseHistoryView settings shell', () => {
  test('uses PluginSettingsPageShell with Contacts-style filter chips + toggle', () => {
    expect(historySrc).toMatch(/PluginSettingsPageShell/);
    expect(historySrc).toMatch(/ListFilterChipsToggle/);
    expect(historySrc).toMatch(/usePersistedFiltersVisible/);
    expect(historySrc).toMatch(/LIST_FILTER_CHIP_ACTIVE_CLASS/);
    expect(historySrc).toMatch(/LIST_FILTER_CHIP_CLASS/);
    expect(historySrc).toMatch(/togglePulseHistoryListFilter/);
    expect(historySrc).toMatch(/key: 'all'/);
    expect(historySrc).toMatch(/key: 'failed'/);
    expect(historySrc).toMatch(/key: 'today'/);
    expect(historySrc).toMatch(/onClose=\{handleClose\}/);
    expect(historySrc).toMatch(/trailing=/);
    expect(historySrc).toMatch(/RefreshCw/);
    expect(historySrc).not.toMatch(/categories=\{categories\}/);
    expect(historySrc).not.toMatch(/SETTINGS_CATEGORY_ICONS/);
    expect(historySrc).not.toMatch(/ListFilterStatCard/);
    expect(historySrc).not.toMatch(/PLUGIN_PAGE_TITLE_CLASS/);
    expect(historySrc).not.toMatch(/ArrowLeft/);
    expect(historySrc).not.toMatch(/backToProviders/);
  });

  test('mounts history in settings page shell (bg + padding)', () => {
    expect(historySrc).toMatch(
      /plugin-pulses flex min-h-0 flex-1 flex-col overflow-y-auto bg-background/,
    );
    expect(historySrc).toMatch(/px-4 py-4 md:px-6/);
    expect(listSrc).toMatch(/pulsesContentView === 'history'/);
    expect(listSrc).toMatch(/PulseHistoryView/);
  });

  test('plugin source filter sits beside ListFilterChipsToggle (sort-style DropdownMenu)', () => {
    expect(historySrc).toMatch(/DropdownMenu/);
    expect(historySrc).toMatch(/DropdownMenuRadioGroup/);
    expect(historySrc).toMatch(/headerDropdownTriggerClass/);
    expect(historySrc).toMatch(/bg-primary\/10/);
    expect(historySrc).toMatch(/ALL_PLUGINS_VALUE/);
    expect(historySrc).toMatch(/renderPluginDropdown\('h-11 rounded-full'\)/);
    expect(historySrc).toMatch(/ListFilterChipsToggle/);
    expect(historySrc).not.toMatch(/<select/);
  });

  test('uses RoundExpandableSearch like Contacts (not ListSearchInput)', () => {
    expect(historySrc).toMatch(/RoundExpandableSearch/);
    expect(historySrc).not.toMatch(/ListSearchInput/);
  });

  test('uses Contacts-style selection mode + BulkActionRoundBar', () => {
    expect(historySrc).toMatch(/selectionMode/);
    expect(historySrc).toMatch(/renderSelectControls/);
    expect(historySrc).toMatch(/BulkActionRoundBar/);
    expect(historySrc).toMatch(/CheckSquare/);
    expect(historySrc).toMatch(/handleEnterSelectionMode/);
    expect(historySrc).toMatch(/handleExitSelectionMode/);
    expect(historySrc).toMatch(/selectionMode \? \(/);
    expect(historySrc).not.toMatch(/from '@\/core\/ui\/BulkActionBar'/);
  });
});

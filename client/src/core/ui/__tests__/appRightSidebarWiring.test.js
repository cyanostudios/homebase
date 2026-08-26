const fs = require('fs');
const path = require('path');

const uiDir = path.join(__dirname, '..');
const localesDir = path.join(__dirname, '../../../i18n/locales');

const mainLayout = fs.readFileSync(path.join(uiDir, 'MainLayout.tsx'), 'utf8');
const appRightSidebar = fs.readFileSync(path.join(uiDir, 'AppRightSidebar.tsx'), 'utf8');
const detailLayout = fs.readFileSync(path.join(uiDir, 'DetailLayout.tsx'), 'utf8');
const topBar = fs.readFileSync(path.join(uiDir, 'TopBar.tsx'), 'utf8');
const context = fs.readFileSync(path.join(uiDir, 'RightSidebarContext.tsx'), 'utf8');
const en = fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8');
const sv = fs.readFileSync(path.join(localesDir, 'sv.json'), 'utf8');

describe('App right sidebar wiring', () => {
  test('MainLayout provides RightSidebarProvider and renders AppRightSidebar', () => {
    expect(mainLayout).toMatch(/RightSidebarProvider/);
    expect(mainLayout).toMatch(/<AppRightSidebar\s*\/>/);
  });

  test('RightSidebarContext defaults closed', () => {
    expect(context).toMatch(/useState\(false\)/);
    expect(context).toMatch(/RIGHT_SIDEBAR_PLUGIN_SLOT_ID/);
  });

  test('AppRightSidebar is desktop-only and hosts the plugin slot', () => {
    expect(appRightSidebar).toMatch(/hidden h-full shrink-0[\s\S]*lg:flex/);
    expect(appRightSidebar).toMatch(/RIGHT_SIDEBAR_PLUGIN_SLOT_ID/);
    expect(appRightSidebar).toMatch(/getTopBarWidgets/);
    expect(appRightSidebar).toMatch(/openSettingsPanel/);
  });

  test('DetailLayout portals via helpers when right rail is open', () => {
    expect(detailLayout).toMatch(/shouldPreferDetailSidebarPortal/);
    expect(detailLayout).toMatch(/shouldPortalDetailSidebar/);
    expect(detailLayout).toMatch(/createPortal/);
    expect(detailLayout).toMatch(/useRightSidebarOptional/);
    expect(detailLayout).toMatch(/useIsDesktopLayout/);
  });

  test('TopBar no longer renders TopBar widgets', () => {
    expect(topBar).not.toMatch(/getTopBarWidgets/);
    expect(topBar).not.toMatch(/openWidgetId/);
    expect(topBar).not.toMatch(/pomodoroClockEnabled/);
  });

  test('i18n keys exist in en and sv', () => {
    for (const locale of [en, sv]) {
      expect(locale).toMatch(/"rightSidebar"\s*:/);
      expect(locale).toMatch(/"toggle"\s*:/);
      expect(locale).toMatch(/"widgets"\s*:/);
      expect(locale).toMatch(/"settings"\s*:/);
      expect(locale).toMatch(/"details"\s*:/);
    }
  });
});

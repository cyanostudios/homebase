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

  test('RightSidebarContext is fixed-rail flyout state (no expand)', () => {
    expect(context).toMatch(/RIGHT_SIDEBAR_WIDTH_PX/);
    expect(context).toMatch(/RightSidebarPanelId/);
    expect(context).toMatch(/activePanel/);
    expect(context).not.toMatch(/RIGHT_SIDEBAR_EXPANDED/);
    expect(context).not.toMatch(/RIGHT_SIDEBAR_PLUGIN_SLOT/);
    expect(context).not.toMatch(/isOpen/);
  });

  test('AppRightSidebar is a fixed rail with four tools and a slide-out', () => {
    expect(appRightSidebar).toMatch(/hidden[\s\S]*lg:block/);
    expect(appRightSidebar).toMatch(/RIGHT_SIDEBAR_WIDTH_PX/);
    expect(appRightSidebar).toMatch(/RightSidebarFlyout/);
    expect(appRightSidebar).toMatch(/PomodoroPanel/);
    expect(appRightSidebar).toMatch(/PomodoroRailButton/);
    expect(appRightSidebar).toMatch(/PomodoroProvider/);
    expect(appRightSidebar).toMatch(/TimerPanel/);
    expect(appRightSidebar).toMatch(/UserPrefsPanel/);
    expect(appRightSidebar).toMatch(/UserAvatarButton/);
    expect(appRightSidebar).toMatch(/RoundIconLabelButton/);
    expect(appRightSidebar).toMatch(/navigateToSettings/);
    expect(appRightSidebar).not.toMatch(/SettingsPanel/);
    expect(appRightSidebar).not.toMatch(/getTopBarWidgets/);
    expect(appRightSidebar).not.toMatch(/PanelRightOpen/);
    expect(appRightSidebar).not.toMatch(/RIGHT_SIDEBAR_PLUGIN_SLOT/);
  });

  test('DetailLayout keeps plugin sidebar inline (no app-rail portal)', () => {
    expect(detailLayout).not.toMatch(/createPortal/);
    expect(detailLayout).not.toMatch(/useRightSidebar/);
    expect(detailLayout).not.toMatch(/detailLayoutPortal/);
  });

  test('TopBar user menu is phone/pad only', () => {
    expect(topBar).toMatch(/TopBarUserMenu/);
    expect(topBar).toMatch(/lg:hidden/);
    expect(topBar).not.toMatch(/getTopBarWidgets/);
  });

  test('i18n keys exist in en and sv', () => {
    for (const locale of [en, sv]) {
      expect(locale).toMatch(/"rightSidebar"\s*:/);
      expect(locale).toMatch(/"rail"\s*:/);
      expect(locale).toMatch(/"pomodoro"\s*:/);
      expect(locale).toMatch(/"timer"\s*:/);
      expect(locale).toMatch(/"settings"\s*:/);
      expect(locale).toMatch(/"userPrefs"\s*:/);
    }
  });
});

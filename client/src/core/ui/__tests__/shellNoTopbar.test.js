const fs = require('fs');
const path = require('path');

const uiDir = path.join(__dirname, '..');
const appContentPath = path.join(__dirname, '../../app/AppContent.tsx');
const stylesPath = path.join(uiDir, 'pluginPageStyles.ts');

const mainLayout = fs.readFileSync(path.join(uiDir, 'MainLayout.tsx'), 'utf8');
const sidebar = fs.readFileSync(path.join(uiDir, 'Sidebar.tsx'), 'utf8');
const brand = fs.readFileSync(path.join(uiDir, 'sidebar/SidebarBrand.tsx'), 'utf8');
const mobileShell = fs.readFileSync(path.join(uiDir, 'mobile/MobileShellControls.tsx'), 'utf8');
const appContent = fs.readFileSync(appContentPath, 'utf8');
const styles = fs.readFileSync(stylesPath, 'utf8');

describe('Shell without TopBar', () => {
  test('MainLayout has no TopBar and applies mobile top inset', () => {
    expect(mainLayout).not.toMatch(/TopBar/);
    expect(mainLayout).not.toMatch(/detailPanelBreadcrumbLabel/);
    expect(mainLayout).toMatch(/MobileShellControls/);
    expect(mainLayout).toMatch(/MOBILE_SHELL_TOP_INSET_CLASS/);
    expect(mainLayout).toMatch(/CONTENT_SHELL_Y_GUTTER_CLASS/);
    expect(mainLayout).toMatch(/CONTENT_SHELL_BOTTOM_GUTTER_CLASS/);
    expect(styles).toMatch(/MOBILE_SHELL_TOP_INSET_CLASS/);
    expect(styles).toMatch(/CONTENT_SHELL_Y_GUTTER_CLASS/);
  });

  test('Sidebar hosts non-clickable brand and no TopBar clearance padding', () => {
    expect(sidebar).toMatch(/SidebarBrand/);
    expect(sidebar).not.toMatch(/pt-14/);
    expect(brand).not.toMatch(/onGoDashboard/);
    expect(brand).not.toMatch(/<button/);
    expect(brand).toMatch(/organizationName/);
  });

  test('Floating Menu hides while nav sheet is open', () => {
    expect(mobileShell).toMatch(/!mobileNavOpen/);
    expect(mobileShell).toMatch(/Open navigation|openNavigation/);
  });

  test('AppContent no longer wires breadcrumb labels', () => {
    expect(appContent).not.toMatch(/detailPanelBreadcrumbLabel/);
    expect(fs.existsSync(path.join(uiDir, 'TopBar.tsx'))).toBe(false);
    expect(fs.existsSync(path.join(uiDir, 'topbar/TopBarBreadcrumbs.tsx'))).toBe(false);
  });
});

const fs = require('fs');
const path = require('path');

const uiDir = path.join(__dirname, '..');
const companionPanel = fs.readFileSync(path.join(uiDir, 'CompanionPanel.tsx'), 'utf8');
const mainLayout = fs.readFileSync(path.join(uiDir, 'MainLayout.tsx'), 'utf8');
const flyout = fs.readFileSync(path.join(uiDir, 'rightSidebar/RightSidebarFlyout.tsx'), 'utf8');

describe('Companion / right-rail panel exit animation', () => {
  test('CompanionPanel keeps mounted through close transition', () => {
    expect(companionPanel).toMatch(/COMPANION_PANEL_ANIMATION_MS/);
    expect(companionPanel).toMatch(/shouldRender/);
    expect(companionPanel).toMatch(/animOpen/);
    expect(companionPanel).toMatch(/transition-\[transform,opacity\]/);
    expect(companionPanel).toMatch(/translate-x-4 opacity-0/);
    expect(companionPanel).toMatch(/cachedTitleRef/);
    expect(companionPanel).toMatch(/cachedChildrenRef/);
    expect(companionPanel).not.toMatch(/animate-in/);
  });

  test('MainLayout keeps CompanionPanel mounted on desktop for exit', () => {
    expect(mainLayout).toMatch(/isOpen=\{companionPanelOpen\}/);
    expect(mainLayout).not.toMatch(/showCompanion/);
    expect(mainLayout).toMatch(/CompanionPanel/);
  });

  test('RightSidebarFlyout retains content and transitions both ways', () => {
    expect(flyout).toMatch(/transition-\[transform,opacity\]/);
    expect(flyout).toMatch(/translate-x-full opacity-0/);
    expect(flyout).toMatch(/translate-x-0 opacity-100/);
    expect(flyout).toMatch(/cachedTitleRef/);
    expect(flyout).toMatch(/cachedChildrenRef/);
  });

  test('Timer state lives in TimerProvider so closing the flyout does not stop it', () => {
    const timerContext = fs.readFileSync(path.join(uiDir, 'rightSidebar/TimerContext.tsx'), 'utf8');
    const timerPanel = fs.readFileSync(path.join(uiDir, 'rightSidebar/TimerPanel.tsx'), 'utf8');
    const appRightSidebar = fs.readFileSync(path.join(uiDir, 'AppRightSidebar.tsx'), 'utf8');
    expect(timerContext).toMatch(/TimerProvider/);
    expect(timerContext).toMatch(/setInterval/);
    expect(timerContext).toMatch(/MAX_TIMERS\s*=\s*3/);
    expect(timerContext).toMatch(/isRunning/);
    expect(timerPanel).toMatch(/useTimer/);
    expect(timerPanel).toMatch(/addTimer/);
    expect(timerPanel).toMatch(/Add timer|addTimer/);
    expect(appRightSidebar).toMatch(/TimerProvider/);
  });
});

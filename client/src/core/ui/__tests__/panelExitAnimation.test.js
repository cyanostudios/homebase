const fs = require('fs');
const path = require('path');

const uiDir = path.join(__dirname, '..');
const appRightSidebar = fs.readFileSync(path.join(uiDir, 'AppRightSidebar.tsx'), 'utf8');
const flyout = fs.readFileSync(path.join(uiDir, 'rightSidebar/RightSidebarFlyout.tsx'), 'utf8');
const mainLayout = fs.readFileSync(path.join(uiDir, 'MainLayout.tsx'), 'utf8');

describe('Companion / right-rail panel exit animation', () => {
  test('RightSidebarFlyout retains content and transitions both ways', () => {
    expect(flyout).toMatch(/RIGHT_SIDEBAR_FLYOUT_ANIMATION_MS/);
    expect(flyout).toMatch(/transition-\[transform,opacity\]/);
    expect(flyout).toMatch(/translate-x-full opacity-0/);
    expect(flyout).toMatch(/translate-x-0 opacity-100/);
    expect(flyout).toMatch(/cachedTitleRef/);
    expect(flyout).toMatch(/cachedChildrenRef/);
    expect(flyout).not.toMatch(/animate-in/);
  });

  test('AppRightSidebar hosts companion as a wider RightSidebarFlyout', () => {
    expect(appRightSidebar).toMatch(/RightSidebarFlyout/);
    expect(appRightSidebar).toMatch(/RIGHT_SIDEBAR_COMPANION_FLYOUT_WIDTH_PX/);
    expect(appRightSidebar).toMatch(/open=\{companionOpen\}/);
    expect(appRightSidebar).toMatch(/isCompanion/);
    expect(appRightSidebar).toMatch(/useCompanionPanel/);
    expect(appRightSidebar).not.toMatch(/from ['"]@\/core\/ui\/CompanionPanel['"]/);
  });

  test('MainLayout no longer mounts inline CompanionPanel', () => {
    expect(mainLayout).not.toMatch(/from ['"]@\/core\/ui\/CompanionPanel['"]/);
    expect(mainLayout).not.toMatch(/companionPanelOpen/);
    expect(mainLayout).not.toMatch(/showCompanion/);
  });

  test('Timer state lives in TimerProvider so closing the flyout does not stop it', () => {
    const timerContext = fs.readFileSync(path.join(uiDir, 'rightSidebar/TimerContext.tsx'), 'utf8');
    const timerPanel = fs.readFileSync(path.join(uiDir, 'rightSidebar/TimerPanel.tsx'), 'utf8');
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

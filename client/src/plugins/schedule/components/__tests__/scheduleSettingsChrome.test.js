const fs = require('fs');
const path = require('path');

const listSrc = fs.readFileSync(path.join(__dirname, '../ScheduleList.tsx'), 'utf8');
const settingsSrc = fs.readFileSync(path.join(__dirname, '../ScheduleSettingsView.tsx'), 'utf8');
const lockToggleSrc = fs.readFileSync(path.join(__dirname, '../ScheduleLockToggle.tsx'), 'utf8');

describe('Schedule settings chrome hygiene', () => {
  test('settings is full-page only; no legacy panel settings or inline category buttons', () => {
    expect(listSrc).toMatch(/scheduleContentView === 'settings'/);
    expect(listSrc).toMatch(/ScheduleSettingsView/);
    expect(listSrc).not.toMatch(/renderCategoryButtonsInline/);
    expect(settingsSrc).not.toMatch(/renderCategoryButtonsInline/);
    expect(settingsSrc).not.toMatch(/panelMode === 'settings'/);
  });

  test('lock toggle has no deprecated unused iconClassName prop', () => {
    expect(lockToggleSrc).not.toMatch(/iconClassName/);
    expect(lockToggleSrc).not.toMatch(/@deprecated/);
  });
});

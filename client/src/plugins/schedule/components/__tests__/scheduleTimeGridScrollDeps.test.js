const fs = require('fs');
const path = require('path');

const gridSrc = fs.readFileSync(path.join(__dirname, '../ScheduleTimeGrid.tsx'), 'utf8');

describe('ScheduleTimeGrid preferred scroll deps', () => {
  test('initial scroll depends on hour values, not gridSettings object identity', () => {
    expect(gridSrc).toMatch(/getPreferredScrollTopPx/);
    expect(gridSrc).toMatch(/\[gridSettings\.startHour,\s*gridSettings\.endHour\]/);
    expect(gridSrc).not.toMatch(
      /node\.scrollTop = getPreferredScrollTopPx\(gridSettings\);\n {2}\}, \[gridSettings\]\)/,
    );
  });
});

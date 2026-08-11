const fs = require('fs');
const path = require('path');

const sectionSrc = fs.readFileSync(path.join(__dirname, '../TeamRequestsSection.tsx'), 'utf8');

describe('TeamRequestsSection overview filtering', () => {
  test('compact overview only shows open requests', () => {
    expect(sectionSrc).toMatch(/isOpenRequestStatus/);
    expect(sectionSrc).toMatch(
      /compact \? requests\.filter\(\(r\) => isOpenRequestStatus\(r\.status\)\) : requests/,
    );
  });
});

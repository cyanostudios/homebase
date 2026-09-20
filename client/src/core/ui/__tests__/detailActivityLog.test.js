const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '../DetailActivityLog.tsx'), 'utf8');

describe('DetailActivityLog', () => {
  test('renders always-open card without Collapsible', () => {
    expect(src).not.toMatch(/from '@\/components\/ui\/collapsible'/);
    expect(src).not.toMatch(/Collapsible/);
    expect(src).not.toMatch(/defaultOpen/);
    expect(src).toMatch(/<Card/);
    expect(src).toMatch(/History/);
  });

  test('keeps optional reset action in the header', () => {
    expect(src).toMatch(/showClearButton \? \(/);
    expect(src).toMatch(/activityLog\.reset/);
  });

  test('can show system display id from the old Information card', () => {
    expect(src).toMatch(/systemId\?:/);
    expect(src).toMatch(/systemIdLabel/);
    expect(src).toMatch(/common\.id/);
    expect(src).toMatch(/DETAIL_INFO_ROW_CLASS/);
  });
});

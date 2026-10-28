const fs = require('fs');
const path = require('path');

const clearSrc = fs.readFileSync(path.join(__dirname, '../ListChipRowClear.tsx'), 'utf8');

describe('ListChipRowClear wiring', () => {
  test('is a white shell with red X via RoundIconLabelButton', () => {
    expect(clearSrc).toMatch(/RoundIconLabelButton/);
    expect(clearSrc).toMatch(/bg-white/);
    expect(clearSrc).toMatch(/text-red-600/);
    expect(clearSrc).toMatch(/expandOnHover=\{false\}/);
    expect(clearSrc).toMatch(/if \(!visible\)/);
  });
});

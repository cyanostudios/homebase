const fs = require('fs');
const path = require('path');

const viewSrc = fs.readFileSync(path.join(__dirname, '../TeamView.tsx'), 'utf8');
const stylesSrc = fs.readFileSync(
  path.join(__dirname, '../../../../core/ui/detailViewCardStyles.ts'),
  'utf8',
);

describe('TeamView detail tab chips', () => {
  test('uses compact list filter chip tokens (same size/colors as list filters)', () => {
    expect(viewSrc).toMatch(/LIST_FILTER_CHIP_ACTIVE_CLASS/);
    expect(viewSrc).toMatch(/LIST_FILTER_CHIP_CLASS/);
    expect(viewSrc).toMatch(/LIST_FILTER_CHIP_ROW_CLASS/);
    expect(viewSrc).not.toMatch(/LIST_FILTER_CHIP_LG_/);
    expect(viewSrc).toMatch(/aria-pressed=\{isActive\}/);
    expect(viewSrc).toMatch(/h-3\.5 w-3\.5/);
  });

  test('large chip tokens are removed from shared styles', () => {
    expect(stylesSrc).not.toMatch(/LIST_FILTER_CHIP_LG_/);
    expect(stylesSrc).toMatch(/export const LIST_FILTER_CHIP_CLASS/);
    expect(stylesSrc).toMatch(/export const LIST_FILTER_CHIP_ACTIVE_CLASS/);
  });
});

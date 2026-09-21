const fs = require('fs');
const path = require('path');

describe('EstimateProvider deep-link wiring', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../context/EstimateProvider.tsx'), 'utf8');

  test('uses pathname deep-link ref pattern', () => {
    expect(src).toMatch(/estimatesDeepLinkPathSyncedRef/);
    expect(src).toMatch(/useLocation/);
  });

  test('openEstimateForEdit primes deep-link ref before navigate (avoids view bounce)', () => {
    expect(src).toMatch(/openEstimateForEdit/);
    expect(src).toMatch(/estimatesDeepLinkPathSyncedRef\.current = `\/estimates\/\$\{slug\}`/);
    const editIdx = src.indexOf('const openEstimateForEdit');
    const stampIdx = src.indexOf(
      'estimatesDeepLinkPathSyncedRef.current = `/estimates/${slug}`',
      editIdx,
    );
    const navigateIdx = src.indexOf(
      "navigateToItem(estimate, estimates, 'estimateNumber')",
      stampIdx,
    );
    expect(editIdx).toBeGreaterThan(-1);
    expect(stampIdx).toBeGreaterThan(editIdx);
    expect(navigateIdx).toBeGreaterThan(stampIdx);
  });

  test('openEstimatePanel primes deep-link ref when opening existing estimate', () => {
    const panelIdx = src.indexOf('const openEstimatePanel');
    const stampIdx = src.indexOf(
      'estimatesDeepLinkPathSyncedRef.current = `/estimates/${slug}`',
      panelIdx,
    );
    expect(panelIdx).toBeGreaterThan(-1);
    expect(stampIdx).toBeGreaterThan(panelIdx);
    expect(stampIdx).toBeLessThan(src.indexOf('const openEstimateForEdit'));
  });
});

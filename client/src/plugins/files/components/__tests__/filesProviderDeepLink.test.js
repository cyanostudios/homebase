const fs = require('fs');
const path = require('path');

describe('FilesProvider deep-link wiring', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../context/FilesProvider.tsx'), 'utf8');

  test('uses pathname deep-link ref pattern (not didOpenFromUrlRef)', () => {
    expect(src).toMatch(/filesDeepLinkPathSyncedRef/);
    expect(src).toMatch(/useLocation/);
    expect(src).not.toMatch(/didOpenFromUrlRef/);
  });

  test('openFileForEdit primes deep-link ref before navigate', () => {
    expect(src).toMatch(/filesDeepLinkPathSyncedRef\.current = `\/files\/\$\{slug\}`/);
    expect(src).toMatch(/openFileForEdit/);
  });

  test('closeFilePanel primes deep-link ref before navigateToBase', () => {
    expect(src).toMatch(/filesDeepLinkPathSyncedRef\.current = '\/files'/);
    expect(src).toMatch(/closeFilePanel/);
  });

  test('openFileForView opens view mode for mail detail column', () => {
    expect(src).toMatch(/setPanelMode\('view'\)/);
    expect(src).toMatch(/openFileForView/);
  });

  test('exposes getPanelTitle with FileDetailHeaderMenus', () => {
    expect(src).toMatch(/FileDetailHeaderMenus/);
    expect(src).toMatch(/getPanelTitle/);
  });
});

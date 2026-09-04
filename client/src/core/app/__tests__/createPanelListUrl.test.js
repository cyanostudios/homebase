const fs = require('fs');
const path = require('path');

const appContentSrc = fs.readFileSync(path.join(__dirname, '../AppContent.tsx'), 'utf8');
const useItemUrlSrc = fs.readFileSync(path.join(__dirname, '../../hooks/useItemUrl.ts'), 'utf8');

describe('App shell create panel on list URL', () => {
  test('keeps create panels open on plugin list URLs', () => {
    expect(appContentSrc).toMatch(/shouldKeepPanelOpen/);
    expect(appContentSrc).toMatch(/context\.panelMode === 'create'/);
    expect(appContentSrc).toMatch(/isOpen && context\.panelMode !== 'create'/);
  });

  test('navigateToBase only strips an item segment', () => {
    expect(useItemUrlSrc).toMatch(/path === basePath/);
    expect(useItemUrlSrc).toMatch(/path\.startsWith\(`\$\{basePath\}\/`\)/);
  });
});

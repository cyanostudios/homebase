const fs = require('fs');
const path = require('path');

const uiDir = path.join(__dirname, '..');
const sidebarDir = path.join(uiDir, 'sidebar');

const sidebar = fs.readFileSync(path.join(uiDir, 'Sidebar.tsx'), 'utf8');
const mainLayout = fs.readFileSync(path.join(uiDir, 'MainLayout.tsx'), 'utf8');
const navContent = fs.readFileSync(path.join(sidebarDir, 'SidebarNavContent.tsx'), 'utf8');
const brand = fs.readFileSync(path.join(sidebarDir, 'SidebarBrand.tsx'), 'utf8');
const layout = fs.readFileSync(path.join(sidebarDir, 'leftSidebarLayout.ts'), 'utf8');
const context = fs.readFileSync(path.join(sidebarDir, 'LeftSidebarContext.tsx'), 'utf8');

describe('Left sidebar collapse', () => {
  test('defines expanded/collapsed widths and persists preference', () => {
    expect(layout).toMatch(/LEFT_SIDEBAR_EXPANDED_WIDTH_PX\s*=\s*252/);
    expect(layout).toMatch(/LEFT_SIDEBAR_COLLAPSED_WIDTH_PX\s*=\s*72/);
    expect(layout).toMatch(/LEFT_SIDEBAR_COLLAPSED_STORAGE_KEY/);
    expect(context).toMatch(/writeLeftSidebarCollapsed/);
    expect(context).toMatch(/toggleCollapsed/);
  });

  test('Sidebar hosts edge RoundIconLabelButton toggle', () => {
    expect(sidebar).toMatch(/RoundIconLabelButton/);
    expect(sidebar).toMatch(/ChevronLeft/);
    expect(sidebar).toMatch(/ChevronRight/);
    expect(sidebar).toMatch(/translate-x-1\/2/);
    expect(sidebar).toMatch(/top-1/);
    expect(sidebar).toMatch(/size=\"xs\"/);
    expect(sidebar).toMatch(/toggleCollapsed/);
  });

  test('collapsed nav shows category icons only', () => {
    expect(navContent).toMatch(/collapsed/);
    expect(navContent).toMatch(/SectionCategoryIcon/);
    expect(navContent).toMatch(/onCollapsedCategorySelect/);
    expect(navContent).toMatch(/navId/);
    expect(brand).toMatch(/collapsed/);
  });

  test('desktop rail owns left-sidebar-nav id; Sheet does not duplicate it', () => {
    expect(sidebar).toMatch(/navId=\"left-sidebar-nav\"/);
    expect(sidebar).toMatch(/aria-controls=\"left-sidebar-nav\"/);
    // Sheet passes collapsed={false} without navId
    const sheetBlock = sidebar.slice(sidebar.indexOf('<Sheet'));
    expect(sheetBlock).toMatch(/collapsed=\{false\}/);
    expect(sheetBlock).not.toMatch(/navId=/);
  });

  test('MainLayout pads content from left sidebar width', () => {
    expect(mainLayout).toMatch(/LeftSidebarProvider/);
    expect(mainLayout).toMatch(/leftSidebarWidthPx/);
    expect(mainLayout).not.toMatch(/lg:pl-\[252px\]/);
  });
});

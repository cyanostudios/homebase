const fs = require('fs');
const path = require('path');

const listSrc = fs.readFileSync(path.join(__dirname, '../SportadminList.tsx'), 'utf8');
const integrationSrc = fs.readFileSync(
  path.join(__dirname, '../SportadminIntegrationPanel.tsx'),
  'utf8',
);
const teamsSrc = fs.readFileSync(path.join(__dirname, '../SportadminTeamsPanel.tsx'), 'utf8');
const pagesSrc = fs.readFileSync(path.join(__dirname, '../SportadminPagesPanel.tsx'), 'utf8');
const pagesTableSrc = fs.readFileSync(
  path.join(__dirname, '../SportadminPagesListTable.tsx'),
  'utf8',
);
const teamsTableSrc = fs.readFileSync(
  path.join(__dirname, '../SportadminTeamsListTable.tsx'),
  'utf8',
);
const sectionCardSrc = fs.readFileSync(
  path.join(__dirname, '../SportadminSectionCard.tsx'),
  'utf8',
);
const apiSrc = fs.readFileSync(path.join(__dirname, '../../api/sportadminApi.ts'), 'utf8');

describe('Sportadmin settings shell wiring', () => {
  test('list uses PluginSettingsPageShell with Integration Pages Teams Debug', () => {
    expect(listSrc).toMatch(/PluginSettingsPageShell/);
    expect(listSrc).toMatch(/SportadminIntegrationPanel/);
    expect(listSrc).toMatch(/SportadminPagesPanel/);
    expect(listSrc).toMatch(/SportadminTeamsPanel/);
    expect(listSrc).toMatch(/SportadminDebugPanel/);
    expect(listSrc).not.toMatch(/SportadminDemoPanel/);
    expect(listSrc).toMatch(/SettingsHeaderSaveButton/);
    expect(listSrc).not.toMatch(/SortableListTable/);
    expect(listSrc).not.toMatch(/QuickContext/);
    // Pages category is registered before Teams.
    expect(listSrc.indexOf("id: 'pages'")).toBeLessThan(listSrc.indexOf("id: 'teams'"));
  });

  test('section cards use platform DETAIL_VIEW card chrome', () => {
    expect(sectionCardSrc).toMatch(/DETAIL_VIEW_CARD_CLASS/);
    expect(sectionCardSrc).toMatch(/DetailSection/);
    expect(sectionCardSrc).toMatch(/subtleTitle/);
    expect(sectionCardSrc).toMatch(/collapsible/);
    expect(integrationSrc).toMatch(/SportadminSectionCard/);
    expect(teamsSrc).toMatch(/SportadminSectionCard/);
  });

  test('integration panel exposes sync status and connection test patterns', () => {
    expect(integrationSrc).toMatch(/StatusOutlineBadge/);
    expect(integrationSrc).toMatch(/ListFilterStatCard/);
    expect(integrationSrc).toMatch(/sportadminApi\.syncNow/);
    expect(integrationSrc).toMatch(/sportadminApi\.setCronEnabled/);
    expect(integrationSrc).toMatch(/SportadminStaleBanner/);
    expect(integrationSrc).toMatch(/SportadminSyncProgressDialog/);
    expect(integrationSrc).toMatch(/Loader2/);
    expect(integrationSrc).toMatch(/RoundIconLabelButton/);
    expect(integrationSrc).toMatch(/size="xs"/);
    expect(integrationSrc).toMatch(/variant="primary"/);
    expect(integrationSrc).toMatch(/Switch/);
  });

  test('pages panel is read-only list|detail over cached club pages', () => {
    expect(pagesSrc).toMatch(/sportadminApi\.getPages/);
    expect(pagesSrc).toMatch(/showDesktopSplit/);
    expect(pagesSrc).toMatch(/SportadminStaleBanner/);
    expect(pagesSrc).toMatch(/SportadminPagesListTable/);
    expect(pagesSrc).toMatch(/ListEmptyState/);
    expect(pagesTableSrc).toMatch(/SortableListTable/);
    expect(pagesSrc).toMatch(/RichTextContent/);
    expect(pagesSrc).toMatch(/sportadmin\.pages\.news/);
    expect(pagesSrc).toMatch(/collapsible/);
    expect(pagesSrc).toMatch(/defaultOpen=\{false\}/);
    expect(pagesSrc).toMatch(/openSource/);
    expect(pagesSrc).not.toMatch(/onDelete|onEdit|InlinePanelFormActions/);
  });

  test('teams panel is read-only list|detail over cached teams', () => {
    expect(teamsSrc).toMatch(/sportadminApi\.getTeams/);
    expect(teamsSrc).toMatch(/showDesktopSplit/);
    expect(teamsSrc).toMatch(/SportadminStaleBanner/);
    expect(teamsSrc).toMatch(/SportadminTeamsListTable/);
    expect(teamsSrc).toMatch(/ListEmptyState/);
    expect(teamsTableSrc).toMatch(/SortableListTable/);
    expect(teamsTableSrc).not.toMatch(/selection=/);
    expect(teamsSrc).toMatch(/sportadmin\.teams\.tabs\.description/);
    expect(teamsSrc).toMatch(/sportadmin\.teams\.tabs\.info/);
    expect(teamsSrc).toMatch(/sportadmin\.teams\.tabs\.news/);
    expect(teamsSrc).toMatch(/sportadmin\.teams\.tabs\.matches/);
    expect(teamsSrc).toMatch(/sportadmin\.teams\.tabs\.roster/);
    expect(teamsSrc).toMatch(/sportadmin\.teams\.tabs\.contact/);
    expect(teamsSrc).toMatch(/sportadmin\.teams\.tabs\.source/);
    expect(teamsSrc).toMatch(/detailTab/);
    expect(teamsSrc).toMatch(/LIST_FILTER_CHIP/);
    expect(teamsSrc).toMatch(/upcomingMatches|playedMatches/);
    expect(teamsSrc).toMatch(/selected\.players/);
    expect(teamsSrc).toMatch(/selected\.leaders/);
    expect(teamsSrc).toMatch(/selected\.contact/);
    expect(teamsSrc).toMatch(/description_image_url/);
    expect(teamsSrc).toMatch(/ImageLightbox/);
    expect(teamsSrc).toMatch(/RichTextContent/);
    expect(pagesSrc).toMatch(/ImageLightbox/);
    expect(pagesSrc).toMatch(/description_image_url/);
    // Header / identity thumbs stay plain img (no lightbox).
    expect(teamsSrc).toMatch(/headerImage/);
    expect(teamsSrc).toMatch(/h-12 w-12/);
    expect(teamsSrc).toMatch(/object-contain/);
    expect(teamsSrc).toMatch(/openSource/);
    expect(teamsSrc).toMatch(/noopener noreferrer/);
    expect(teamsSrc).toMatch(/overflow-y-auto/);
    expect(teamsSrc).toMatch(/min-h-0 flex-1/);
    expect(teamsSrc).not.toMatch(/getNews/);
    expect(teamsSrc).not.toMatch(/getMatches/);
    expect(teamsSrc).not.toMatch(/filterGirls|filterBoys|filterAll/);
    expect(teamsSrc).not.toMatch(/onDelete|onEdit|InlinePanelFormActions/);
  });

  test('list owns scroll with contentFlush layout', () => {
    expect(listSrc).toMatch(/flex h-full min-h-0 flex-col overflow-hidden/);
    expect(listSrc).toMatch(/min-h-0 flex-1 overflow-y-auto/);
  });

  test('api client targets /api/sportadmin only', () => {
    expect(apiSrc).toMatch(/createApiClient\('\/sportadmin'/);
    expect(apiSrc).toMatch(/\/config/);
    expect(apiSrc).toMatch(/\/sync/);
    expect(apiSrc).toMatch(/\/discovery/);
    expect(apiSrc).toMatch(/\/pages/);
    expect(apiSrc).toMatch(/\/teams/);
    expect(apiSrc).not.toMatch(/createApiClient\('\/teams'/);
    expect(apiSrc).not.toMatch(/createApiClient\('\/matches'/);
  });
});

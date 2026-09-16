const fs = require('fs');
const path = require('path');

const listSrc = fs.readFileSync(path.join(__dirname, '../AIProvidersList.tsx'), 'utf8');
const tableSrc = fs.readFileSync(path.join(__dirname, '../AIProvidersListTable.tsx'), 'utf8');
const statsSrc = fs.readFileSync(path.join(__dirname, '../AIProvidersStatisticsView.tsx'), 'utf8');
const viewSrc = fs.readFileSync(path.join(__dirname, '../AIProviderView.tsx'), 'utf8');
const formSrc = fs.readFileSync(path.join(__dirname, '../AIProvidersSettingsForm.tsx'), 'utf8');
const registrySrc = fs.readFileSync(
  path.join(__dirname, '../../../../core/pluginRegistry.ts'),
  'utf8',
);

describe('AIProvidersList mail-layout list|content split', () => {
  test('list uses desktop 20/80 grid with statistics empty state', () => {
    expect(listSrc).toMatch(/showDesktopSplit = !isCompactViewport/);
    expect(listSrc).toMatch(/isCompactViewport/);
    expect(listSrc).toMatch(/grid-cols-\[minmax\(220px,20%\)_minmax\(0,1fr\)\]/);
    expect(listSrc).toMatch(/AIProvidersStatisticsView/);
    expect(statsSrc).toMatch(/StatKpiTile/);
    expect(statsSrc).toMatch(/statusEnabled/);
    expect(statsSrc).toMatch(/keyConfigured/);
  });

  test('row click previews provider on desktop and opens panel on compact', () => {
    expect(listSrc).toMatch(/previewProvider/);
    expect(listSrc).toMatch(/handleRowActivate/);
    expect(listSrc).toMatch(/handleOpenForView/);
    expect(listSrc).toMatch(/isCompactViewport/);
    expect(listSrc).toMatch(/openAIProviderForView/);
    expect(listSrc).toMatch(/onRowClick=\{handleRowActivate\}/);
  });

  test('detail column renders stacked view and inline create/edit form', () => {
    expect(listSrc).toMatch(/AIProviderView aiProvider=\{detailProvider\} stacked/);
    expect(listSrc).toMatch(/inlineForm/);
    expect(listSrc).toMatch(/AIProvidersSettingsForm/);
    expect(listSrc).toMatch(/InlinePanelFormActions/);
    expect(listSrc).toMatch(/stacked/);
    expect(viewSrc).toMatch(/stacked\?: boolean/);
    expect(formSrc).toMatch(/stacked\?: boolean/);
    expect(formSrc).toMatch(/gridClassName=\{stacked \? 'grid-cols-1' : undefined\}/);
  });

  test('table highlights active preview row', () => {
    expect(listSrc).toMatch(/activeListProviderId/);
    expect(listSrc).toMatch(/activeProviderId=\{activeListProviderId\}/);
    expect(tableSrc).toMatch(/activeProviderId/);
    expect(tableSrc).toMatch(/bg-sky-50\/80/);
  });

  test('routing early return preserved; registry owns scroll and content view key', () => {
    expect(listSrc).toMatch(/aiProvidersContentView === 'routing'/);
    expect(listSrc).toMatch(
      /plugin-ai-providers flex min-h-0 flex-1 flex-col overflow-y-auto bg-background/,
    );
    expect(listSrc).toMatch(/AIProvidersRouting/);
    expect(registrySrc).toMatch(/name: 'ai-providers'/);
    expect(registrySrc).toMatch(/contentOwnsScroll: true/);
    expect(registrySrc).toMatch(/contentViewKey: 'aiProvidersContentView'/);
  });

  test('toolbar collapse toggle wired like Ingest', () => {
    expect(listSrc).toMatch(/toolbarEdgeToggle/);
    expect(listSrc).toMatch(/usePersistedToolbarCollapsed/);
    expect(listSrc).toMatch(/aiProviders\.collapseToolbar/);
    expect(listSrc).toMatch(/aiProviders\.expandToolbar/);
  });
});

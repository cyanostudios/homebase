const fs = require('fs');
const path = require('path');

const listSrc = fs.readFileSync(path.join(__dirname, '../PulseProvidersList.tsx'), 'utf8');
const tableSrc = fs.readFileSync(path.join(__dirname, '../PulseProvidersListTable.tsx'), 'utf8');
const statsSrc = fs.readFileSync(
  path.join(__dirname, '../PulseProvidersStatisticsView.tsx'),
  'utf8',
);
const formSrc = fs.readFileSync(path.join(__dirname, '../PulseSettingsForm.tsx'), 'utf8');
const registrySrc = fs.readFileSync(
  path.join(__dirname, '../../../../core/pluginRegistry.ts'),
  'utf8',
);

describe('PulseProvidersList mail-layout list|content split', () => {
  test('list uses desktop 20/80 grid with statistics empty state', () => {
    expect(listSrc).toMatch(/showDesktopSplit = !isCompactViewport/);
    expect(listSrc).toMatch(/grid-cols-\[minmax\(220px,20%\)_minmax\(0,1fr\)\]/);
    expect(listSrc).toMatch(/PulseProvidersStatisticsView/);
    expect(statsSrc).toMatch(/StatKpiTile/);
    expect(statsSrc).toMatch(/statusEnabled/);
    expect(statsSrc).toMatch(/keyConfigured/);
  });

  test('row click previews provider on desktop and opens panel on compact', () => {
    expect(listSrc).toMatch(/previewProvider/);
    expect(listSrc).toMatch(/handleRowActivate/);
    expect(listSrc).toMatch(/isCompactViewport/);
    expect(listSrc).toMatch(/openPulseForView/);
    expect(listSrc).toMatch(/onRowClick=\{handleRowActivate\}/);
  });

  test('detail column renders stacked view and inline create/edit form', () => {
    expect(listSrc).toMatch(/PulseProviderView pulse=\{detailProvider\}/);
    expect(listSrc).toMatch(/inlineForm/);
    expect(listSrc).toMatch(/PulseSettingsForm/);
    expect(listSrc).toMatch(/InlinePanelFormActions/);
    expect(listSrc).toMatch(/stacked/);
    expect(formSrc).toMatch(/stacked\?: boolean/);
    expect(formSrc).toMatch(/gridClassName=\{stacked \? 'grid-cols-1' : undefined\}/);
  });

  test('table highlights active preview row', () => {
    expect(listSrc).toMatch(/activeListProviderId/);
    expect(listSrc).toMatch(/activeProviderId=\{activeListProviderId\}/);
    expect(tableSrc).toMatch(/activeProviderId/);
    expect(tableSrc).toMatch(/bg-sky-50\/80/);
  });

  test('registry owns scroll and content view key', () => {
    expect(registrySrc).toMatch(/name: 'pulses'/);
    expect(registrySrc).toMatch(/contentOwnsScroll: true/);
    expect(registrySrc).toMatch(/contentViewKey: 'pulsesContentView'/);
  });

  test('history and routing buttons always expanded', () => {
    expect(listSrc).toMatch(/alwaysExpanded/);
    expect(listSrc).toMatch(/openHistoryView/);
    expect(listSrc).toMatch(/openRoutingView/);
  });
});

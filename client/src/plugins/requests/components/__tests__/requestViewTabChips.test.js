const fs = require('fs');
const path = require('path');

const viewSrc = fs.readFileSync(path.join(__dirname, '../RequestView.tsx'), 'utf8');
const qcSrc = fs.readFileSync(path.join(__dirname, '../RequestQuickContextPanel.tsx'), 'utf8');

describe('RequestView detail tab chips', () => {
  test('uses compact list filter chip tokens (same as Contacts detail tabs)', () => {
    expect(viewSrc).toMatch(/LIST_FILTER_CHIP_ACTIVE_CLASS/);
    expect(viewSrc).toMatch(/LIST_FILTER_CHIP_CLASS/);
    expect(viewSrc).toMatch(/LIST_FILTER_CHIP_ROW_CLASS/);
    expect(viewSrc).toMatch(/aria-pressed=\{isActive\}/);
    expect(viewSrc).toMatch(/h-3\.5 w-3\.5/);
  });

  test('full detail mounts tabs under QuickContext header via headerBelow', () => {
    expect(viewSrc).toMatch(/RequestQuickContextPanel/);
    expect(viewSrc).toMatch(/headerBelow=\{tabChips\}/);
    expect(qcSrc).toMatch(/headerBelow\?: React\.ReactNode/);
    expect(qcSrc).toMatch(/\{headerBelow \? <div className="mt-4">\{headerBelow\}<\/div> : null\}/);
  });

  test('meta row shows internal/external source first', () => {
    expect(qcSrc).toMatch(/REQUEST_SOURCE_COLORS\[request\.source\]/);
    expect(qcSrc).toMatch(/requests\.sourceExternal/);
    expect(qcSrc).toMatch(/requests\.sourceInternal/);
    const metaStart = qcSrc.indexOf('<DetailHeaderMetaRow>');
    expect(metaStart).toBeGreaterThan(-1);
    const metaBlock = qcSrc.slice(metaStart, metaStart + 1200);
    const sourceIdx = metaBlock.indexOf('REQUEST_SOURCE_COLORS[request.source]');
    const typeIdx = metaBlock.indexOf('REQUEST_TYPE_ICON_SHELL_CLASS');
    expect(sourceIdx).toBeGreaterThan(-1);
    expect(typeIdx).toBeGreaterThan(-1);
    expect(sourceIdx).toBeLessThan(typeIdx);
  });

  test('tabs use URL ?tab= with information as default', () => {
    expect(viewSrc).toMatch(/useSearchParams/);
    expect(viewSrc).toMatch(/parseRequestViewTab/);
    expect(viewSrc).toMatch(/'information'/);
    expect(viewSrc).toMatch(/value === 'properties'/); // legacy ?tab=properties → information
    expect(viewSrc).toMatch(/'assignees'/);
    expect(viewSrc).toMatch(/'files'/);
    expect(viewSrc).toMatch(/'activity'/);
    expect(viewSrc).toMatch(/next\.delete\('tab'\)/);
    expect(viewSrc).toMatch(/activeTab === 'information'/);
    expect(viewSrc).toMatch(/requests\.view\.properties[\s\S]*requests\.view\.submitter/);
    expect(viewSrc).not.toMatch(/activeTab === 'properties'/);
    expect(viewSrc).toMatch(/activeTab === 'assignees'/);
    expect(viewSrc).toMatch(/activeTab === 'files'/);
    expect(viewSrc).toMatch(/activeTab === 'activity'/);
    expect(viewSrc).toMatch(/DetailActivityLog/);
    expect(viewSrc).toMatch(/entityType="request"/);
  });

  test('readOnly companion mode uses local tabs limited to information/assignees/files', () => {
    expect(viewSrc).toMatch(/readOnly\?: boolean/);
    expect(viewSrc).toMatch(/headerTrailing\?: React\.ReactNode/);
    expect(viewSrc).toMatch(/REQUEST_VIEW_READONLY_TABS/);
    expect(viewSrc).toMatch(/localTab/);
    expect(viewSrc).toMatch(/const activeTab = readOnly \? localTab : urlTab/);
    expect(viewSrc).toMatch(/if \(readOnly\) \{\s*setLocalTab\(tab\);/);
    expect(viewSrc).toMatch(/REQUEST_VIEW_READONLY_TABS\.includes\(tab\.id\)/);
    expect(viewSrc).toMatch(/!readOnly && activeTab === 'activity'/);
    expect(qcSrc).toMatch(/readOnly\?: boolean/);
    expect(qcSrc).toMatch(/headerTrailing\?: React\.ReactNode/);
    expect(qcSrc).toMatch(/readOnly \? \(/);
    expect(qcSrc).toMatch(/RequestDetailHeaderMenus/);
  });
});

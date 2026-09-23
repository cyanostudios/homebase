const fs = require('fs');
const path = require('path');

const viewSrc = fs.readFileSync(path.join(__dirname, '../TaskView.tsx'), 'utf8');
const qcSrc = fs.readFileSync(path.join(__dirname, '../TaskQuickContextPanel.tsx'), 'utf8');

describe('TaskView detail tab chips', () => {
  test('uses compact list filter chip tokens (same as Contacts detail tabs)', () => {
    expect(viewSrc).toMatch(/LIST_FILTER_CHIP_ACTIVE_CLASS/);
    expect(viewSrc).toMatch(/LIST_FILTER_CHIP_CLASS/);
    expect(viewSrc).toMatch(/LIST_FILTER_CHIP_ROW_CLASS/);
    expect(viewSrc).toMatch(/aria-pressed=\{isActive\}/);
    expect(viewSrc).toMatch(/h-3\.5 w-3\.5/);
  });

  test('full detail mounts tabs under QuickContext header via headerBelow', () => {
    expect(viewSrc).toMatch(/TaskQuickContextPanel/);
    expect(viewSrc).toMatch(/headerBelow=\{tabChips\}/);
    expect(qcSrc).toMatch(/headerBelow\?: React\.ReactNode/);
    expect(qcSrc).toMatch(/\{headerBelow \? <div className="mt-4">\{headerBelow\}<\/div> : null\}/);
  });

  test('tabs use URL ?tab= with information as default', () => {
    expect(viewSrc).toMatch(/useSearchParams/);
    expect(viewSrc).toMatch(/parseTaskViewTab/);
    expect(viewSrc).toMatch(/'information'/);
    expect(viewSrc).toMatch(/value === 'properties'/); // legacy ?tab=properties → information
    expect(viewSrc).toMatch(/'assignees'/);
    expect(viewSrc).toMatch(/'linked'/);
    expect(viewSrc).toMatch(/'activity'/);
    expect(viewSrc).toMatch(/next\.delete\('tab'\)/);
    expect(viewSrc).toMatch(/activeTab === 'information'/);
    expect(viewSrc).toMatch(/activeTab === 'information' \? propertiesCard/);
    expect(viewSrc).not.toMatch(/activeTab === 'properties'/);
    expect(viewSrc).toMatch(/activeTab === 'assignees'/);
    expect(viewSrc).toMatch(/activeTab === 'linked'/);
    expect(viewSrc).toMatch(/activeTab === 'activity'/);
    expect(viewSrc).toMatch(/DetailActivityLog/);
    expect(viewSrc).toMatch(/entityType="task"/);
  });

  test('readOnly companion mode uses local tabs limited to information/assignees', () => {
    expect(viewSrc).toMatch(/readOnly\?: boolean/);
    expect(viewSrc).toMatch(/headerTrailing\?: React\.ReactNode/);
    expect(viewSrc).toMatch(/TASK_VIEW_READONLY_TABS/);
    expect(viewSrc).toMatch(/localTab/);
    expect(viewSrc).toMatch(/const activeTab = readOnly \? localTab : urlTab/);
    expect(viewSrc).toMatch(/if \(readOnly\) \{\s*setLocalTab\(tab\);/);
    expect(viewSrc).toMatch(/TASK_VIEW_READONLY_TABS\.includes\(tab\.id\)/);
    expect(viewSrc).toMatch(/!readOnly && activeTab === 'linked'/);
    expect(viewSrc).toMatch(/!readOnly && activeTab === 'activity'/);
    expect(qcSrc).toMatch(/readOnly\?: boolean/);
    expect(qcSrc).toMatch(/headerTrailing\?: React\.ReactNode/);
    expect(qcSrc).toMatch(/readOnly \? \(/);
    expect(qcSrc).toMatch(/TaskDetailHeaderMenus/);
  });
});

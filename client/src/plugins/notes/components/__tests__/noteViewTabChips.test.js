const fs = require('fs');
const path = require('path');

const viewSrc = fs.readFileSync(path.join(__dirname, '../NoteView.tsx'), 'utf8');
const qcSrc = fs.readFileSync(path.join(__dirname, '../NoteQuickContextPanel.tsx'), 'utf8');

describe('NoteView detail tab chips', () => {
  test('uses compact list filter chip tokens (same as Tasks detail tabs)', () => {
    expect(viewSrc).toMatch(/LIST_FILTER_CHIP_ACTIVE_CLASS/);
    expect(viewSrc).toMatch(/LIST_FILTER_CHIP_CLASS/);
    expect(viewSrc).toMatch(/LIST_FILTER_CHIP_ROW_CLASS/);
    expect(viewSrc).toMatch(/aria-pressed=\{isActive\}/);
    expect(viewSrc).toMatch(/h-3\.5 w-3\.5/);
  });

  test('full detail mounts tabs under QuickContext header via headerBelow', () => {
    expect(viewSrc).toMatch(/NoteQuickContextPanel/);
    expect(viewSrc).toMatch(/headerBelow=\{tabChips\}/);
    expect(qcSrc).toMatch(/headerBelow\?: React\.ReactNode/);
    expect(qcSrc).toMatch(/\{headerBelow \? <div className="mt-4">\{headerBelow\}<\/div> : null\}/);
  });

  test('tabs use URL ?tab= with information as default', () => {
    expect(viewSrc).toMatch(/useSearchParams/);
    expect(viewSrc).toMatch(/parseNoteViewTab/);
    expect(viewSrc).toMatch(/'information'/);
    expect(viewSrc).toMatch(/'linked'/);
    expect(viewSrc).toMatch(/'files'/);
    expect(viewSrc).toMatch(/'activity'/);
    expect(viewSrc).toMatch(/next\.delete\('tab'\)/);
    expect(viewSrc).toMatch(/activeTab === 'information'/);
    expect(viewSrc).toMatch(/activeTab === 'linked'/);
    expect(viewSrc).toMatch(/activeTab === 'files'/);
    expect(viewSrc).toMatch(/activeTab === 'activity'/);
    expect(viewSrc).toMatch(/DetailActivityLog/);
    expect(viewSrc).toMatch(/entityType="note"/);
  });

  test('content lives in information tab card, not QuickContext children', () => {
    expect(viewSrc).toMatch(/notes\.noteContent/);
    expect(viewSrc).toMatch(/RichTextContent/);
    expect(viewSrc).toMatch(/NoteShareBlock/);
    expect(qcSrc).not.toMatch(/children\?/);
  });
});

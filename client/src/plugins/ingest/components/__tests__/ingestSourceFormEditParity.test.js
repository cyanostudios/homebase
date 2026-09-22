const fs = require('fs');
const path = require('path');

const formSrc = fs.readFileSync(path.join(__dirname, '../IngestSourceForm.tsx'), 'utf8');

describe('IngestSourceForm edit UX parity (IngestSourceView shell)', () => {
  test('uses URL ?tab= with same four tabs as IngestSourceView', () => {
    expect(formSrc).toMatch(/useSearchParams/);
    expect(formSrc).toMatch(/parseIngestFormTab/);
    expect(formSrc).toMatch(/'information'/);
    expect(formSrc).toMatch(/'excerpt'/);
    expect(formSrc).toMatch(/'runs'/);
    expect(formSrc).toMatch(/'activity'/);
    expect(formSrc).toMatch(/next\.delete\('tab'\)/);
    expect(formSrc).toMatch(/LIST_FILTER_CHIP_ROW_CLASS/);
  });

  test('excerpt, runs, and activity tabs are greyed out in edit', () => {
    expect(formSrc).toMatch(/INGEST_FORM_EDIT_DISABLED_TABS/);
    expect(formSrc).toMatch(/opacity-40/);
    expect(formSrc).toMatch(/disabled=\{isDisabled\}/);
  });

  test('create/edit registers global leave guard', () => {
    expect(formSrc).toMatch(/registerUnsavedChangesChecker\(key, \(\) => true\)/);
    expect(formSrc).toMatch(/force:\s*true/);
  });

  test('ghost fact field styling', () => {
    expect(formSrc).toMatch(/FORM_GHOST_INPUT_CLASS/);
  });
});

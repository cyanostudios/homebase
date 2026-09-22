const fs = require('fs');
const path = require('path');

const formSrc = fs.readFileSync(path.join(__dirname, '../NoteForm.tsx'), 'utf8');

describe('NoteForm edit UX parity (NoteView shell + focus)', () => {
  test('uses URL ?tab= with same tabs as NoteView', () => {
    expect(formSrc).toMatch(/useSearchParams/);
    expect(formSrc).toMatch(/parseNoteFormTab/);
    expect(formSrc).toMatch(/'information'/);
    expect(formSrc).toMatch(/'linked'/);
    expect(formSrc).toMatch(/'files'/);
    expect(formSrc).toMatch(/'activity'/);
    expect(formSrc).toMatch(/next\.delete\('tab'\)/);
    expect(formSrc).toMatch(/LIST_FILTER_CHIP_ROW_CLASS/);
  });

  test('does not use leftSidebar two-column stack', () => {
    expect(formSrc).not.toMatch(/leftSidebar=\{/);
  });

  test('linked and activity tabs are greyed out and not selectable in edit', () => {
    expect(formSrc).toMatch(/NOTE_FORM_EDIT_DISABLED_TABS/);
    expect(formSrc).toMatch(/opacity-40/);
    expect(formSrc).toMatch(/disabled=\{isDisabled\}/);
  });

  test('create/edit registers global leave guard for list and sidebar navigation', () => {
    expect(formSrc).toMatch(/registerUnsavedChangesChecker\(formKey, \(\) => true\)/);
    expect(formSrc).toMatch(/force:\s*true/);
  });

  test('ghost title and description styling', () => {
    expect(formSrc).toMatch(/DETAIL_FORM_TITLE_INPUT_CLASS/);
    expect(formSrc).toMatch(/variant="ghost"/);
  });

  test('focus mode portals a viewport-centered editor dialog', () => {
    expect(formSrc).toMatch(/createPortal/);
    expect(formSrc).toMatch(/fixed inset-0 z-50 flex items-center justify-center/);
    expect(formSrc).toMatch(/max-w-\[1080px\]/);
    expect(formSrc).toMatch(/aria-modal="true"/);
    expect(formSrc).toMatch(/activeTab === 'information' && !focusMode/);
  });

  test('create/edit form is not legacy panel settings', () => {
    expect(formSrc).not.toMatch(/NoteSettingsForm/);
    expect(formSrc).not.toMatch(/panelMode === 'settings'/);
  });

  test('tab error indicator maps validation fields', () => {
    expect(formSrc).toMatch(/TAB_ERROR_FIELDS/);
    expect(formSrc).toMatch(/tabHasError/);
    expect(formSrc).toMatch(/bg-destructive/);
  });
});

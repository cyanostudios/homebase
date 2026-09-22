const fs = require('fs');
const path = require('path');

const contactForm = fs.readFileSync(path.join(__dirname, '../ContactForm.tsx'), 'utf8');
const noteForm = fs.readFileSync(
  path.join(__dirname, '../../../notes/components/NoteForm.tsx'),
  'utf8',
);
const formFieldStyles = fs.readFileSync(
  path.join(__dirname, '../../../../core/ui/formFieldStyles.ts'),
  'utf8',
);

describe('ghost fact-field edit chrome (Contacts + Notes)', () => {
  test('formFieldStyles defines ghost family without changing filled defaults', () => {
    expect(formFieldStyles).toMatch(/FORM_GHOST_INPUT_CLASS/);
    expect(formFieldStyles).toMatch(/FORM_GHOST_SELECT_CLASS/);
    expect(formFieldStyles).toMatch(/FORM_INPUT_CLASS = `h-7/);
    expect(formFieldStyles).toMatch(/bg-muted/);
  });

  test('ContactForm uses ghost tokens for fact fields, not filled FORM_INPUT_CLASS', () => {
    expect(contactForm).toMatch(/FORM_GHOST_INPUT_CLASS/);
    expect(contactForm).toMatch(/FORM_GHOST_SELECT_CLASS/);
    expect(contactForm).toMatch(/FORM_GHOST_PROP_CONTROL_CLASS/);
    expect(contactForm).toMatch(/FORM_GHOST_TEXTAREA_CLASS/);
    expect(contactForm).not.toMatch(/\bFORM_INPUT_CLASS\b/);
    expect(contactForm).not.toMatch(/\bFORM_PROP_CONTROL_CLASS\b/);
    expect(contactForm).toMatch(/DETAIL_FORM_TITLE_INPUT_CLASS/);
    expect(contactForm).toMatch(/bg-muted\/40|FORM_FIELD_GHOST_CHROME|FORM_GHOST_INPUT_CLASS/);
    expect(contactForm).toMatch(/syncNotesTextareaHeight/);
    expect(contactForm).toMatch(/syncTextareaHeight/);
  });

  test('NoteForm uses title token + ghost rich text, not filled title input', () => {
    expect(noteForm).toMatch(/DETAIL_FORM_TITLE_INPUT_CLASS/);
    expect(noteForm).toMatch(/RichTextEditor[\s\S]*?variant="ghost"/);
    expect(noteForm).not.toMatch(/\bFORM_INPUT_CLASS\b/);
    expect(noteForm).not.toMatch(/\bFORM_GHOST_INPUT_CLASS\b/);
  });
});

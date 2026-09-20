const {
  FORM_FIELD_FILLED_CHROME,
  FORM_INPUT_CLASS,
  FORM_PROP_CONTROL_CLASS,
  FORM_TEXTAREA_CLASS,
  FORM_COMPACT_INPUT_CLASS,
  FORM_FIELD_GHOST_CHROME,
  FORM_GHOST_INPUT_CLASS,
  FORM_GHOST_SELECT_CLASS,
  FORM_GHOST_PROP_CONTROL_CLASS,
  FORM_GHOST_TEXTAREA_CLASS,
  FORM_INPUT_ERROR_CLASS,
} = require('../formFieldStyles');

describe('formFieldStyles', () => {
  test('filled chrome keeps muted compact controls (settings / dense grids)', () => {
    expect(FORM_FIELD_FILLED_CHROME).toMatch(/bg-muted/);
    expect(FORM_INPUT_CLASS).toMatch(/h-7/);
    expect(FORM_INPUT_CLASS).toMatch(/md:text-xs/);
    expect(FORM_PROP_CONTROL_CLASS).toMatch(/max-w-\[180px\]/);
    expect(FORM_TEXTAREA_CLASS).toMatch(/bg-muted/);
    expect(FORM_COMPACT_INPUT_CLASS).toMatch(/md:text-\[11px\]/);
  });

  test('ghost chrome is transparent and view-matched (no muted fill box)', () => {
    expect(FORM_FIELD_GHOST_CHROME).toMatch(/bg-transparent/);
    expect(FORM_FIELD_GHOST_CHROME).not.toMatch(/bg-muted/);
    expect(FORM_GHOST_INPUT_CLASS).toMatch(/text-base/);
    expect(FORM_GHOST_INPUT_CLASS).toMatch(/font-extrabold/);
    expect(FORM_GHOST_INPUT_CLASS).toMatch(/min-h-9/);
    expect(FORM_GHOST_INPUT_CLASS).not.toMatch(/\bh-7\b/);
    expect(FORM_GHOST_INPUT_CLASS).not.toMatch(/bg-muted/);
    expect(FORM_GHOST_SELECT_CLASS).toMatch(/font-extrabold/);
    expect(FORM_GHOST_PROP_CONTROL_CLASS).toMatch(/max-w-\[180px\]/);
    expect(FORM_GHOST_TEXTAREA_CLASS).toMatch(/font-extrabold/);
  });

  test('ghost and filled share ring-based validation (border invisible with border-0)', () => {
    expect(FORM_INPUT_ERROR_CLASS).toMatch(/ring-destructive/);
    expect(FORM_FIELD_GHOST_CHROME).toMatch(/focus-visible:ring-1/);
    expect(FORM_FIELD_FILLED_CHROME).toMatch(/focus-visible:ring-1/);
  });
});

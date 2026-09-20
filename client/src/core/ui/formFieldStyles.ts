/**
 * Shared form-field chrome for plugin create/edit and settings.
 *
 * Two families:
 * - **Filled** (`FORM_INPUT_*`): compact muted controls — settings, dense grids
 *   (invoice lines, PersonMatrix, inventory steppers). Do not change these for
 *   detail fact-field edit.
 * - **Ghost** (`FORM_GHOST_*`): transparent, view-matched typography for plugin
 *   detail create/edit fact fields (Contacts-class). Reference: view
 *   `DETAIL_FIELD_VALUE_CLASS` + hero `DETAIL_FORM_TITLE_INPUT_CLASS`.
 *
 * Do not change shadcn Input/Textarea/NativeSelect defaults — apply via className.
 */

/** Borderless muted control chrome + tight focus ring. */
export const FORM_FIELD_FILLED_CHROME =
  'border-0 bg-muted shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-0 focus:outline-none focus:ring-1 focus:ring-ring focus:ring-offset-0';

/** Standard text/number input in form cards. */
export const FORM_INPUT_CLASS = `h-7 w-full px-2 py-0 text-base md:text-xs ${FORM_FIELD_FILLED_CHROME}`;

/** Narrow property-row controls (max ~180px). */
export const FORM_PROP_CONTROL_CLASS = `h-7 w-full max-w-[180px] px-2 py-0 text-base md:text-xs ${FORM_FIELD_FILLED_CHROME}`;

/** Textarea with filled chrome. */
export const FORM_TEXTAREA_CLASS = `min-h-[56px] px-2 py-1.5 text-base md:text-xs ${FORM_FIELD_FILLED_CHROME}`;

/**
 * Compact dense rows (invoice line items, garment variants).
 * Same chrome; slightly smaller md text; hides number spin buttons.
 */
export const FORM_COMPACT_INPUT_CLASS = `h-7 w-full px-2 py-0 text-base md:text-[11px] ${FORM_FIELD_FILLED_CHROME} [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]`;

/** Compact native/select in dense rows. */
export const FORM_COMPACT_SELECT_CLASS = `h-7 w-full px-1.5 py-0 text-base md:text-[11px] ${FORM_FIELD_FILLED_CHROME}`;

/**
 * Validation error on filled/ghost fields — border-* is invisible with border-0.
 * Combine with FORM_INPUT_CLASS / FORM_GHOST_INPUT_CLASS / FORM_TEXTAREA_CLASS etc.
 */
export const FORM_INPUT_ERROR_CLASS =
  'ring-1 ring-destructive focus:ring-destructive focus-visible:ring-destructive';

/** Read-only filled control. */
export const FORM_INPUT_READONLY_CLASS = 'cursor-not-allowed text-muted-foreground';

// ─── Ghost (view-matched detail fact fields) ─────────────────────────────────

/**
 * Transparent chrome — no muted fill. Focus ring is required (WCAG focus-visible).
 * Typography matches `DETAIL_FIELD_VALUE_CLASS` (`text-base font-extrabold`).
 */
export const FORM_FIELD_GHOST_CHROME =
  'border-0 bg-transparent shadow-none rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-0 focus:outline-none focus:ring-1 focus:ring-ring focus:ring-offset-0';

/**
 * Fact-field text input in plugin detail create/edit.
 * Same scale/weight as view values; min-height for touch target without a gray box.
 */
export const FORM_GHOST_INPUT_CLASS = `h-auto min-h-9 w-full px-0 py-0.5 text-base font-extrabold text-foreground placeholder:font-normal placeholder:text-muted-foreground/70 ${FORM_FIELD_GHOST_CHROME}`;

/**
 * NativeSelect / SelectTrigger in fact grids — ghost typography; native chevron remains.
 */
export const FORM_GHOST_SELECT_CLASS = `h-auto min-h-9 w-full px-0 py-0.5 text-base font-extrabold text-foreground ${FORM_FIELD_GHOST_CHROME}`;

/**
 * Narrow property-row ghost controls (tax / currency / assignable).
 * Prefer over FORM_PROP_CONTROL_CLASS when the row mirrors detail view values.
 */
export const FORM_GHOST_PROP_CONTROL_CLASS = `h-auto min-h-9 w-full max-w-[180px] px-0 py-0.5 text-base font-extrabold text-foreground ${FORM_FIELD_GHOST_CHROME}`;

/** Multi-line fact field (e.g. contact notes). */
export const FORM_GHOST_TEXTAREA_CLASS = `min-h-[56px] w-full resize-y px-0 py-1 text-base font-extrabold text-foreground placeholder:font-normal placeholder:text-muted-foreground/70 ${FORM_FIELD_GHOST_CHROME}`;

/** Read-only ghost control (e.g. contact number on create). */
export const FORM_GHOST_READONLY_CLASS = 'cursor-not-allowed text-muted-foreground';

/**
 * Shared filled form-field chrome for plugin create/edit and settings.
 * Reference: invoice edit (compact, borderless, muted bg).
 * Do not change shadcn Input/Textarea/NativeSelect defaults — apply these via className.
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
 * Validation error on filled fields — border-* is invisible with border-0.
 * Combine with FORM_INPUT_CLASS / FORM_TEXTAREA_CLASS etc.
 */
export const FORM_INPUT_ERROR_CLASS =
  'ring-1 ring-destructive focus:ring-destructive focus-visible:ring-destructive';

/** Read-only filled control. */
export const FORM_INPUT_READONLY_CLASS = 'cursor-not-allowed text-muted-foreground';

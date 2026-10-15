import type { TFunction } from 'i18next';

/** Quantity exactly ±1 → singular; otherwise plural (incl. 0 and fractions). */
export function isSingularUnitQuantity(quantity: number): boolean {
  const q = Number(quantity);
  return q === 1 || q === -1;
}

/**
 * Translate a known invoice line-item unit key with singular/plural via i18n count.
 * Unknown/custom units are returned as-is.
 */
export function translateInvoiceUnit(
  t: TFunction,
  unit: string | null | undefined,
  quantity: number = 1,
): string {
  const key = String(unit || '').trim();
  if (!key) {
    return '';
  }
  const count = isSingularUnitQuantity(quantity) ? 1 : 2;
  return t(`invoices.units.${key}`, { count, defaultValue: key });
}

/** Swedish Facio document labels (mirror of plugins/invoices/unitLabels.js). */
const UNIT_LABELS_SV: Record<string, { one: string; other: string }> = {
  piece: { one: 'Styck', other: 'Stycken' },
  hour: { one: 'Timme', other: 'Timmar' },
  day: { one: 'Dag', other: 'Dagar' },
  week: { one: 'Vecka', other: 'Veckor' },
  month: { one: 'Månad', other: 'Månader' },
};

/** For PDF/web Facio templates (always Swedish). */
export function formatUnitLabelSv(unit: string, quantity: number = 1): string {
  const key = String(unit || '').trim();
  const entry = UNIT_LABELS_SV[key];
  if (!entry) {
    return key;
  }
  return isSingularUnitQuantity(quantity) ? entry.one : entry.other;
}

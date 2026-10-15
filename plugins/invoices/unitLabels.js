/**
 * Swedish Facio document unit labels (singular / plural by quantity).
 * Quantity exactly ±1 → singular; otherwise plural (incl. 0 and fractions).
 */

const UNIT_LABELS_SV = Object.freeze({
  piece: { one: 'Styck', other: 'Stycken' },
  hour: { one: 'Timme', other: 'Timmar' },
  day: { one: 'Dag', other: 'Dagar' },
  week: { one: 'Vecka', other: 'Veckor' },
  month: { one: 'Månad', other: 'Månader' },
});

function isSingularQuantity(quantity) {
  const q = Number(quantity);
  return q === 1 || q === -1;
}

/**
 * @param {string} unit
 * @param {number} [quantity=1]
 * @returns {string}
 */
function formatUnitLabelSv(unit, quantity = 1) {
  const key = String(unit || '').trim();
  const entry = UNIT_LABELS_SV[key];
  if (!entry) {
    return key;
  }
  return isSingularQuantity(quantity) ? entry.one : entry.other;
}

module.exports = {
  UNIT_LABELS_SV,
  isSingularQuantity,
  formatUnitLabelSv,
};

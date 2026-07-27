/** tax_rate / payment_terms are INT in tenant schema; never send "". */
function toNullableInt(value) {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  if (trimmed === '') return null;
  const n = Number.parseInt(trimmed, 10);
  return Number.isFinite(n) ? n : null;
}

module.exports = { toNullableInt };

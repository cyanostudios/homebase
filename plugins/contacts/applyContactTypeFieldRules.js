const { toNullableInt } = require('./toNullableInt');

/** Canonical DB contact_type: company | private. */
function normalizeStoredContactType(contactType) {
  return String(contactType || '')
    .trim()
    .toLowerCase() === 'private'
    ? 'private'
    : 'company';
}

/**
 * Private contacts: clear company-only fields, force tax_rate 0, clear f_tax.
 * Company contacts: pass through with tax_rate coerced via toNullableInt.
 */
function applyContactTypeFieldRules(contactType, contactData) {
  const isPrivate = contactType === 'private';
  return {
    company_type: isPrivate ? '' : contactData.companyType || '',
    organization_number: isPrivate ? '' : contactData.organizationNumber || '',
    vat_number: isPrivate ? '' : contactData.vatNumber || '',
    tax_rate: isPrivate ? 0 : toNullableInt(contactData.taxRate),
    f_tax: isPrivate ? '' : contactData.fTax || '',
  };
}

module.exports = { normalizeStoredContactType, applyContactTypeFieldRules };

// Tenant organization profile (shared account identity on main DB `tenants.organization`).

const EMPTY_ORGANIZATION = Object.freeze({
  name: '',
  logoUrl: '',
  website: '',
  email: '',
  phone: '',
  address: Object.freeze({
    line1: '',
    line2: '',
    postalCode: '',
    city: '',
    country: '',
  }),
  billing: Object.freeze({
    organizationNumber: '',
    vatNumber: '',
    bankgiro: '',
    plusgiro: '',
    iban: '',
    bic: '',
    invoiceEmail: '',
    swishNumber: '',
    fTax: 'yes',
    latePaymentInterest: '12',
  }),
});

const MAX_CONTACT_STRING = 255;

function asString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function asContactString(value) {
  const trimmed = asString(value);
  return trimmed.length > MAX_CONTACT_STRING ? trimmed.slice(0, MAX_CONTACT_STRING) : trimmed;
}

/** F-tax approval: 'yes' | 'no' (mirrors contacts). Default yes for company issuers. */
function asFTax(value) {
  const raw = asString(value).toLowerCase();
  if (raw === 'no' || raw === 'false' || raw === '0') {
    return 'no';
  }
  return 'yes';
}

/** Late payment interest as percent string (e.g. "12"). Clamped 0–100. */
function asLatePaymentInterest(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.min(100, Math.max(0, value)));
  }
  const raw = asString(value);
  if (!raw) {
    return '12';
  }
  const n = parseFloat(raw.replace(',', '.'));
  if (!Number.isFinite(n)) {
    return '12';
  }
  return String(Math.min(100, Math.max(0, n)));
}

function normalizeOrganization(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const address =
    source.address && typeof source.address === 'object' && !Array.isArray(source.address)
      ? source.address
      : {};
  const billing =
    source.billing && typeof source.billing === 'object' && !Array.isArray(source.billing)
      ? source.billing
      : {};

  return {
    name: asString(source.name),
    logoUrl: asString(source.logoUrl),
    website: asContactString(source.website),
    email: asContactString(source.email),
    phone: asContactString(source.phone) || asContactString(billing.phone),
    address: {
      line1: asString(address.line1),
      line2: asString(address.line2),
      postalCode: asString(address.postalCode),
      city: asString(address.city),
      country: asString(address.country),
    },
    billing: {
      organizationNumber: asString(billing.organizationNumber),
      vatNumber: asString(billing.vatNumber),
      bankgiro: asString(billing.bankgiro),
      plusgiro: asString(billing.plusgiro),
      iban: asString(billing.iban),
      bic: asString(billing.bic),
      invoiceEmail: asString(billing.invoiceEmail),
      swishNumber: asString(billing.swishNumber),
      fTax: asFTax(billing.fTax),
      latePaymentInterest: asLatePaymentInterest(billing.latePaymentInterest),
    },
  };
}

class OrganizationService {
  /**
   * @param {import('pg').Pool} pool - Main DB pool
   */
  constructor(pool) {
    this.pool = pool;
  }

  /**
   * @param {number} tenantId
   * @returns {Promise<ReturnType<typeof normalizeOrganization>>}
   */
  async getOrganization(tenantId) {
    const result = await this.pool.query('SELECT organization FROM tenants WHERE id = $1', [
      tenantId,
    ]);
    if (!result.rows.length) {
      return normalizeOrganization(EMPTY_ORGANIZATION);
    }
    return normalizeOrganization(result.rows[0].organization);
  }

  /**
   * Replaces the full organization document (normalized).
   * @param {number} tenantId
   * @param {unknown} payload
   * @returns {Promise<ReturnType<typeof normalizeOrganization>>}
   */
  async updateOrganization(tenantId, payload) {
    const next = normalizeOrganization(payload);
    const result = await this.pool.query(
      `UPDATE tenants
       SET organization = $2::jsonb, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING organization`,
      [tenantId, JSON.stringify(next)],
    );
    if (!result.rows.length) {
      throw new Error('Account not found');
    }
    return normalizeOrganization(result.rows[0].organization);
  }
}

module.exports = {
  OrganizationService,
  normalizeOrganization,
  EMPTY_ORGANIZATION,
};

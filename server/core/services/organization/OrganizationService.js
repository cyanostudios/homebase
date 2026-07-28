// Tenant organization profile (shared account identity on main DB `tenants.organization`).

const EMPTY_ORGANIZATION = Object.freeze({
  name: '',
  logoUrl: '',
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
    phone: '',
  }),
});

function asString(value) {
  return typeof value === 'string' ? value.trim() : '';
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
      phone: asString(billing.phone),
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

// Tenant default mail texts (shared account settings on main DB `tenants.default_texts`).

const EMPTY_DEFAULT_TEXTS = Object.freeze({
  invoiceMail: '',
  estimateMail: '',
});

const MAX_MAIL_TEXT = 8000;

function asMailText(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  return raw.length > MAX_MAIL_TEXT ? raw.slice(0, MAX_MAIL_TEXT) : raw;
}

function normalizeDefaultTexts(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return {
    invoiceMail: asMailText(source.invoiceMail),
    estimateMail: asMailText(source.estimateMail),
  };
}

class DefaultTextsService {
  /**
   * @param {import('pg').Pool} pool - Main DB pool
   */
  constructor(pool) {
    this.pool = pool;
  }

  /**
   * @param {number} tenantId
   * @returns {Promise<ReturnType<typeof normalizeDefaultTexts>>}
   */
  async getDefaultTexts(tenantId) {
    const result = await this.pool.query('SELECT default_texts FROM tenants WHERE id = $1', [
      tenantId,
    ]);
    if (!result.rows.length) {
      return normalizeDefaultTexts(EMPTY_DEFAULT_TEXTS);
    }
    return normalizeDefaultTexts(result.rows[0].default_texts);
  }

  /**
   * Replaces the full default texts document (normalized).
   * @param {number} tenantId
   * @param {unknown} payload
   * @returns {Promise<ReturnType<typeof normalizeDefaultTexts>>}
   */
  async updateDefaultTexts(tenantId, payload) {
    const next = normalizeDefaultTexts(payload);
    const result = await this.pool.query(
      `UPDATE tenants
       SET default_texts = $2::jsonb, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING default_texts`,
      [tenantId, JSON.stringify(next)],
    );
    if (!result.rows.length) {
      throw new Error('Account not found');
    }
    return normalizeDefaultTexts(result.rows[0].default_texts);
  }
}

module.exports = {
  DefaultTextsService,
  normalizeDefaultTexts,
  EMPTY_DEFAULT_TEXTS,
  MAX_MAIL_TEXT,
};

const { AppError } = require('../../server/core/errors/AppError');
const { parseLanguage } = require('../guides/validation');

/**
 * SQL fragment: place + master guide + presentation rows that satisfy the
 * public gate (active place; published, approved, fresh presentation).
 * Aligns with guides model `_assertPlaceHasPublishablePresentation`.
 */
const PUBLIC_PRESENTATION_JOIN = `
  INNER JOIN guide_master_guides mg ON mg.id = gp.master_guide_id
  INNER JOIN guide_places p ON p.id = mg.place_id
`;

const PUBLIC_PRESENTATION_WHERE = `
  p.user_id = $1
  AND p.lifecycle_status = 'active'
  AND gp.publication_status = 'published'
  AND gp.approval_status = 'approved'
  AND gp.staleness_status = 'fresh'
`;

function parseOptionalLanguageQuery(value) {
  if (value === null || value === undefined || String(value).trim() === '') {
    return null;
  }
  return parseLanguage(value);
}

function parsePositiveInt(value, label) {
  const n = parseInt(String(value), 10);
  if (!Number.isFinite(n) || n <= 0) {
    throw new AppError(`Invalid ${label}`, 400, AppError.CODES.VALIDATION_ERROR);
  }
  return n;
}

class PublicGuidesModel {
  transformPlace(row) {
    return {
      id: String(row.id),
      displayName: row.display_name ?? '',
      shortIntro: row.short_intro ?? null,
      geographicReference: row.geographic_reference ?? null,
      sourceLanguage: row.source_language ?? 'sv',
    };
  }

  transformPresentation(row) {
    return {
      id: String(row.id),
      language: row.language ?? 'sv',
      presentationText: row.presentation_text ?? null,
    };
  }

  /**
   * @param {import('pg').Pool} pool
   * @param {number} ownerUserId
   * @param {string|null} language
   */
  async listPlaces(pool, ownerUserId, language) {
    const params = [ownerUserId];
    let languageClause = '';
    if (language) {
      params.push(language);
      languageClause = ` AND gp.language = $${params.length}`;
    }

    const result = await pool.query(
      `
        SELECT DISTINCT
          p.id,
          p.display_name,
          p.short_intro,
          p.geographic_reference,
          mg.source_language
        FROM guide_places p
        INNER JOIN guide_master_guides mg ON mg.place_id = p.id
        INNER JOIN guide_presentations gp ON gp.master_guide_id = mg.id
        WHERE p.user_id = $1
          AND p.lifecycle_status = 'active'
          AND gp.publication_status = 'published'
          AND gp.approval_status = 'approved'
          AND gp.staleness_status = 'fresh'
          ${languageClause}
        ORDER BY p.display_name ASC
      `,
      params,
    );

    return result.rows.map((row) => this.transformPlace(row));
  }

  /**
   * @param {import('pg').Pool} pool
   * @param {number} ownerUserId
   * @param {number} placeId
   */
  async getPlaceById(pool, ownerUserId, placeId) {
    const result = await pool.query(
      `
        SELECT DISTINCT
          p.id,
          p.display_name,
          p.short_intro,
          p.geographic_reference,
          mg.source_language
        FROM guide_places p
        INNER JOIN guide_master_guides mg ON mg.place_id = p.id
        INNER JOIN guide_presentations gp ON gp.master_guide_id = mg.id
        WHERE p.id = $2
          AND p.user_id = $1
          AND p.lifecycle_status = 'active'
          AND gp.publication_status = 'published'
          AND gp.approval_status = 'approved'
          AND gp.staleness_status = 'fresh'
        LIMIT 1
      `,
      [ownerUserId, placeId],
    );

    if (!result.rows.length) {
      return null;
    }
    return this.transformPlace(result.rows[0]);
  }

  /**
   * Public presentations for a place, or null if the place is not public.
   *
   * @param {import('pg').Pool} pool
   * @param {number} ownerUserId
   * @param {number} placeId
   * @param {string|null} language
   */
  async listPresentations(pool, ownerUserId, placeId, language) {
    const placePublic = await this.getPlaceById(pool, ownerUserId, placeId);
    if (!placePublic) {
      return null;
    }

    const params = [ownerUserId, placeId];
    let languageClause = '';
    if (language) {
      params.push(language);
      languageClause = ` AND gp.language = $${params.length}`;
    }

    const result = await pool.query(
      `
        SELECT
          gp.id,
          gp.language,
          gp.presentation_text
        FROM guide_presentations gp
        ${PUBLIC_PRESENTATION_JOIN}
        WHERE mg.place_id = $2
          AND ${PUBLIC_PRESENTATION_WHERE}
          ${languageClause}
        ORDER BY gp.language ASC, gp.id ASC
      `,
      params,
    );

    return result.rows.map((row) => this.transformPresentation(row));
  }

  parseOptionalLanguageQuery(value) {
    return parseOptionalLanguageQuery(value);
  }

  parsePositiveInt(value, label) {
    return parsePositiveInt(value, label);
  }
}

module.exports = PublicGuidesModel;
module.exports.__testOnly = {
  PUBLIC_PRESENTATION_JOIN,
  PUBLIC_PRESENTATION_WHERE,
  parseOptionalLanguageQuery,
  parsePositiveInt,
};

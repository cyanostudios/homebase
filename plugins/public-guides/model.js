const { Logger } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');
const { parseLanguage } = require('../guides/validation');
const {
  ensureStorageProvidersRegistered,
} = require('../../server/core/storage/registerDefaultAdapters');
const StorageProviderRegistry = require('../../server/core/storage/StorageProviderRegistry');
const { parseStorageRef } = require('../guides/audio/storageRef');

/** SQL fragment: variant + audio rows that satisfy Epic 7 public gate (A3). */
const PUBLIC_VARIANT_JOIN = `
  INNER JOIN guide_stops gs ON gs.id = gvp.stop_id
  INNER JOIN guide_master_guides mg ON mg.id = gs.master_guide_id
  INNER JOIN guide_places p ON p.id = mg.place_id
  INNER JOIN guide_audio ga ON ga.variant_presentation_id = gvp.id
`;

const PUBLIC_VARIANT_WHERE = `
  p.user_id = $1
  AND p.lifecycle_status = 'active'
  AND gvp.publication_status = 'published'
  AND gvp.staleness_status = 'fresh'
  AND ga.status = 'ready'
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

  transformVariant(row) {
    return {
      id: String(row.id),
      variantType: row.variant_type ?? 'normal',
      language: row.language ?? 'sv',
      presentationText: row.presentation_text ?? null,
      hasAudio: true,
    };
  }

  transformStop(row, variants) {
    return {
      id: String(row.id),
      title: row.title ?? '',
      sequenceOrder: Number(row.sequence_order),
      variants,
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
      languageClause = ` AND gvp.language = $${params.length}`;
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
        INNER JOIN guide_stops gs ON gs.master_guide_id = mg.id
        INNER JOIN guide_variant_presentations gvp ON gvp.stop_id = gs.id
        INNER JOIN guide_audio ga ON ga.variant_presentation_id = gvp.id
        WHERE p.user_id = $1
          AND p.lifecycle_status = 'active'
          AND gvp.publication_status = 'published'
          AND gvp.staleness_status = 'fresh'
          AND ga.status = 'ready'
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
        INNER JOIN guide_stops gs ON gs.master_guide_id = mg.id
        INNER JOIN guide_variant_presentations gvp ON gvp.stop_id = gs.id
        INNER JOIN guide_audio ga ON ga.variant_presentation_id = gvp.id
        WHERE p.id = $2
          AND p.user_id = $1
          AND p.lifecycle_status = 'active'
          AND gvp.publication_status = 'published'
          AND gvp.staleness_status = 'fresh'
          AND ga.status = 'ready'
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
   * @param {import('pg').Pool} pool
   * @param {number} ownerUserId
   * @param {number} placeId
   * @param {string|null} language
   */
  async listStopsWithVariants(pool, ownerUserId, placeId, language) {
    const stopParams = [ownerUserId, placeId];
    const stopsResult = await pool.query(
      `
        SELECT DISTINCT gs.id, gs.title, gs.sequence_order
        FROM guide_stops gs
        INNER JOIN guide_master_guides mg ON mg.id = gs.master_guide_id
        INNER JOIN guide_places p ON p.id = mg.place_id
        INNER JOIN guide_variant_presentations gvp ON gvp.stop_id = gs.id
        INNER JOIN guide_audio ga ON ga.variant_presentation_id = gvp.id
        WHERE mg.place_id = $2
          AND p.user_id = $1
          AND p.lifecycle_status = 'active'
          AND gvp.publication_status = 'published'
          AND gvp.staleness_status = 'fresh'
          AND ga.status = 'ready'
        ORDER BY gs.sequence_order ASC
      `,
      stopParams,
    );

    if (!stopsResult.rows.length) {
      return null;
    }

    const variantParams = [ownerUserId, placeId];
    let languageClause = '';
    if (language) {
      variantParams.push(language);
      languageClause = ` AND gvp.language = $${variantParams.length}`;
    }

    const variantsResult = await pool.query(
      `
        SELECT
          gvp.id,
          gvp.stop_id,
          gvp.variant_type,
          gvp.language,
          gvp.presentation_text,
          gs.sequence_order
        FROM guide_variant_presentations gvp
        ${PUBLIC_VARIANT_JOIN}
        WHERE mg.place_id = $2
          AND ${PUBLIC_VARIANT_WHERE}
          ${languageClause}
        ORDER BY gs.sequence_order ASC, gvp.variant_type ASC, gvp.language ASC, gvp.id ASC
      `,
      variantParams,
    );

    const variantsByStop = new Map();
    for (const row of variantsResult.rows) {
      const stopId = String(row.stop_id);
      if (!variantsByStop.has(stopId)) {
        variantsByStop.set(stopId, []);
      }
      variantsByStop.get(stopId).push(this.transformVariant(row));
    }

    return stopsResult.rows.map((stopRow) =>
      this.transformStop(stopRow, variantsByStop.get(String(stopRow.id)) ?? []),
    );
  }

  /**
   * @param {import('pg').Pool} pool
   * @param {number} ownerUserId
   * @param {number} placeId
   * @param {number} stopId
   * @param {number} variantId
   */
  async getReadyAudioForPublicVariant(pool, ownerUserId, placeId, stopId, variantId) {
    const result = await pool.query(
      `
        SELECT ga.storage_ref, ga.mime_type
        FROM guide_audio ga
        INNER JOIN guide_variant_presentations gvp ON gvp.id = ga.variant_presentation_id
        ${PUBLIC_VARIANT_JOIN}
        WHERE ${PUBLIC_VARIANT_WHERE}
          AND mg.place_id = $2
          AND gs.id = $3
          AND gvp.id = $4
        LIMIT 1
      `,
      [ownerUserId, placeId, stopId, variantId],
    );

    if (!result.rows.length) {
      return null;
    }

    const row = result.rows[0];
    if (!row.storage_ref) {
      return null;
    }

    return {
      storageRef: row.storage_ref,
      mimeType: row.mime_type || 'application/octet-stream',
    };
  }

  /**
   * @param {import('express').Request} req
   * @param {{ storageRef: string, mimeType: string }} audio
   */
  async openAudioStream(req, audio) {
    const { providerKey, externalFileId } = parseStorageRef(audio.storageRef);
    ensureStorageProvidersRegistered();
    if (!StorageProviderRegistry.has(providerKey)) {
      throw new AppError('Storage provider not available', 500, AppError.CODES.DATABASE_ERROR);
    }
    const provider = StorageProviderRegistry.get(providerKey);
    return {
      stream: await provider.download(req, { externalFileId }),
      mimeType: audio.mimeType,
    };
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
  PUBLIC_VARIANT_JOIN,
  PUBLIC_VARIANT_WHERE,
  parseOptionalLanguageQuery,
  parsePositiveInt,
};

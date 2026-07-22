// plugins/guides/model.js
const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');
const {
  DEFAULT_SOURCE_LANGUAGE,
  DEFAULT_MASTER_GUIDE_EDITORIAL_STATUS,
  DEFAULT_PUBLICATION_STATUS,
  DEFAULT_STALENESS_STATUS,
  DEFAULT_APPROVAL_STATUS,
  parseLifecycleStatus,
  parseMasterGuideEditorialStatus,
  parseSourceLanguage,
  parsePublicationStatus,
  parseLanguage,
} = require('./validation');

const PLACES_TABLE = 'guide_places';
const MASTER_GUIDES_TABLE = 'guide_master_guides';
const PRESENTATIONS_TABLE = 'guide_presentations';

function sanitizeDisplayName(value) {
  const trimmed = (value || '').toString().trim();
  if (!trimmed) {
    throw new AppError('Display name is required', 400, AppError.CODES.VALIDATION_ERROR);
  }
  return trimmed.slice(0, 255);
}

function sanitizeOptionalText(value, maxLength) {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function sanitizePresentationText(value) {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed.slice(0, 50000) : null;
}

function narrativesEqual(a, b) {
  return String(a ?? '') === String(b ?? '');
}

function parseBoundedNumber(value, min, max, label) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new AppError(`${label} is out of range`, 400, AppError.CODES.VALIDATION_ERROR);
  }
  return parsed;
}

function sanitizePlaceTypes(value) {
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value)) {
    throw new AppError('place.placeTypes must be an array', 400, AppError.CODES.VALIDATION_ERROR);
  }
  const cleaned = value
    .map((item) =>
      String(item ?? '')
        .trim()
        .toLowerCase(),
    )
    .filter(Boolean)
    .slice(0, 20);
  return cleaned.length ? cleaned : null;
}

function sanitizeBbox(value) {
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value) || value.length !== 4) {
    throw new AppError(
      'place.bbox must be an array of 4 numbers',
      400,
      AppError.CODES.VALIDATION_ERROR,
    );
  }
  const nums = value.map((n) => Number(n));
  if (nums.some((n) => !Number.isFinite(n))) {
    throw new AppError('place.bbox must contain numbers', 400, AppError.CODES.VALIDATION_ERROR);
  }
  return nums;
}

function sanitizeResolvedAt(value) {
  if (value === null || value === undefined || value === '') return new Date().toISOString();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(
      'place.resolvedAt must be a valid date',
      400,
      AppError.CODES.VALIDATION_ERROR,
    );
  }
  return date.toISOString();
}

/**
 * Normalize an API PlaceResolved snapshot (camelCase) into DB-ready fields.
 * Returns null when place is null/undefined (place cleared / not set).
 * @param {object|null|undefined} place
 */
function sanitizePlaceSnapshot(place) {
  if (place === null || place === undefined) return null;
  if (typeof place !== 'object' || Array.isArray(place)) {
    throw new AppError('place must be an object', 400, AppError.CODES.VALIDATION_ERROR);
  }

  const provider = sanitizeOptionalText(place.provider, 50);
  if (!provider) {
    throw new AppError('place.provider is required', 400, AppError.CODES.VALIDATION_ERROR);
  }
  const displayName = sanitizeOptionalText(place.displayName, 255);
  if (!displayName) {
    throw new AppError('place.displayName is required', 400, AppError.CODES.VALIDATION_ERROR);
  }

  let latitude = null;
  let longitude = null;
  if (place.coordinates !== null && place.coordinates !== undefined) {
    if (typeof place.coordinates !== 'object' || Array.isArray(place.coordinates)) {
      throw new AppError(
        'place.coordinates must be an object',
        400,
        AppError.CODES.VALIDATION_ERROR,
      );
    }
    latitude = parseBoundedNumber(place.coordinates.lat, -90, 90, 'place.coordinates.lat');
    longitude = parseBoundedNumber(place.coordinates.lng, -180, 180, 'place.coordinates.lng');
  }

  return {
    provider: provider.toLowerCase(),
    providerRef: sanitizeOptionalText(place.providerRef, 255),
    displayName,
    formattedAddress: sanitizeOptionalText(place.formattedAddress, 500),
    latitude,
    longitude,
    countryCode: place.countryCode
      ? String(place.countryCode).trim().toUpperCase().slice(0, 2)
      : null,
    adminArea: sanitizeOptionalText(place.adminArea, 255),
    locality: sanitizeOptionalText(place.locality, 255),
    placeTypes: sanitizePlaceTypes(place.placeTypes),
    bbox: sanitizeBbox(place.bbox),
    resolvedAt: sanitizeResolvedAt(place.resolvedAt),
  };
}

function parseGeneratedLanguages(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((lang) => String(lang).trim().toLowerCase()).filter(Boolean);
  }
  return [];
}

function buildPlaceFromRow(row) {
  if (!row || !row.place_provider) return null;
  const lat = row.latitude != null ? Number(row.latitude) : null;
  const lng = row.longitude != null ? Number(row.longitude) : null;
  return {
    provider: row.place_provider,
    providerRef: row.place_provider_ref ?? null,
    displayName: row.resolved_name ?? '',
    formattedAddress: row.formatted_address ?? null,
    coordinates: lat != null && lng != null ? { lat, lng } : null,
    countryCode: row.country_code ?? null,
    adminArea: row.admin_area ?? null,
    locality: row.locality ?? null,
    placeTypes: Array.isArray(row.place_types) ? row.place_types : [],
    bbox: Array.isArray(row.bbox) ? row.bbox : null,
    resolvedAt: row.place_resolved_at ?? null,
  };
}

class GuidesModel {
  transformRow(placeRow, masterGuideRow) {
    if (!placeRow) return null;
    return {
      id: String(placeRow.id),
      displayName: placeRow.display_name ?? '',
      shortIntro: placeRow.short_intro ?? null,
      geographicReference: placeRow.geographic_reference ?? null,
      place: buildPlaceFromRow(placeRow),
      lifecycleStatus: placeRow.lifecycle_status ?? 'draft',
      ingestSourceId: placeRow.ingest_source_id != null ? String(placeRow.ingest_source_id) : null,
      ingestRunId: placeRow.ingest_run_id != null ? String(placeRow.ingest_run_id) : null,
      masterGuideId: masterGuideRow ? String(masterGuideRow.id) : null,
      sourceLanguage: masterGuideRow?.source_language ?? DEFAULT_SOURCE_LANGUAGE,
      masterGuideEditorialStatus:
        masterGuideRow?.editorial_status ?? DEFAULT_MASTER_GUIDE_EDITORIAL_STATUS,
      languages: parseGeneratedLanguages(placeRow.generated_languages),
      createdAt: placeRow.created_at,
      updatedAt: placeRow.updated_at,
    };
  }

  async getAll(req) {
    try {
      const db = Database.get(req);
      const rows = await db.query(
        `
          SELECT
            p.*,
            mg.id AS master_guide_id,
            mg.source_language,
            mg.editorial_status AS master_editorial_status,
            COALESCE(lang.languages, ARRAY[]::text[]) AS generated_languages
          FROM ${PLACES_TABLE} p
          INNER JOIN ${MASTER_GUIDES_TABLE} mg ON mg.place_id = p.id
          LEFT JOIN LATERAL (
            SELECT ARRAY_AGG(gp.language ORDER BY gp.language) AS languages
            FROM ${PRESENTATIONS_TABLE} gp
            WHERE gp.master_guide_id = mg.id
              AND NULLIF(TRIM(gp.presentation_text), '') IS NOT NULL
          ) lang ON true
          ORDER BY p.updated_at DESC, p.id DESC
        `,
        [],
      );
      return rows.map((row) =>
        this.transformRow(row, {
          id: row.master_guide_id,
          source_language: row.source_language,
          editorial_status: row.master_editorial_status,
        }),
      );
    } catch (error) {
      Logger.error('Failed to fetch guides places', error);
      throw new AppError('Failed to fetch places', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async getById(req, placeId) {
    try {
      const db = Database.get(req);
      const rows = await db.query(
        `
          SELECT
            p.*,
            mg.id AS master_guide_id,
            mg.source_language,
            mg.editorial_status AS master_editorial_status,
            COALESCE(lang.languages, ARRAY[]::text[]) AS generated_languages
          FROM ${PLACES_TABLE} p
          INNER JOIN ${MASTER_GUIDES_TABLE} mg ON mg.place_id = p.id
          LEFT JOIN LATERAL (
            SELECT ARRAY_AGG(gp.language ORDER BY gp.language) AS languages
            FROM ${PRESENTATIONS_TABLE} gp
            WHERE gp.master_guide_id = mg.id
              AND NULLIF(TRIM(gp.presentation_text), '') IS NOT NULL
          ) lang ON true
          WHERE p.id = $1
        `,
        [placeId],
      );
      if (!rows.length) {
        throw new AppError('Place not found', 404, AppError.CODES.NOT_FOUND);
      }
      const row = rows[0];
      return this.transformRow(row, {
        id: row.master_guide_id,
        source_language: row.source_language,
        editorial_status: row.master_editorial_status,
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to fetch guide place', error, { placeId });
      throw new AppError('Failed to fetch place', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async create(req, data) {
    try {
      const db = Database.get(req);
      const userId = db.getUserId();
      if (!userId) {
        throw new AppError('User context required', 401, AppError.CODES.UNAUTHORIZED);
      }

      const displayName = sanitizeDisplayName(data.displayName);
      const shortIntro = sanitizeOptionalText(data.shortIntro, 5000);
      const placeSnapshot = sanitizePlaceSnapshot(data.place);
      let geographicReference = sanitizeOptionalText(data.geographicReference, 255);
      if (!geographicReference && placeSnapshot) {
        geographicReference =
          (placeSnapshot.formattedAddress || placeSnapshot.displayName || '')
            .toString()
            .slice(0, 255) || null;
      }
      const lifecycleStatus = parseLifecycleStatus(data.lifecycleStatus);
      const sourceLanguage = parseSourceLanguage(data.sourceLanguage);

      const created = await db.transaction(async (tx) => {
        const placeRows = await tx.query(
          `
            INSERT INTO ${PLACES_TABLE} (
              user_id,
              display_name,
              short_intro,
              geographic_reference,
              lifecycle_status,
              place_provider,
              place_provider_ref,
              resolved_name,
              formatted_address,
              latitude,
              longitude,
              country_code,
              admin_area,
              locality,
              place_types,
              bbox,
              place_resolved_at
            )
            VALUES (
              $1, $2, $3, $4, $5,
              $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, $16::jsonb, $17
            )
            RETURNING *
          `,
          [
            userId,
            displayName,
            shortIntro,
            geographicReference,
            lifecycleStatus,
            placeSnapshot?.provider ?? null,
            placeSnapshot?.providerRef ?? null,
            placeSnapshot?.displayName ?? null,
            placeSnapshot?.formattedAddress ?? null,
            placeSnapshot?.latitude ?? null,
            placeSnapshot?.longitude ?? null,
            placeSnapshot?.countryCode ?? null,
            placeSnapshot?.adminArea ?? null,
            placeSnapshot?.locality ?? null,
            placeSnapshot?.placeTypes ? JSON.stringify(placeSnapshot.placeTypes) : null,
            placeSnapshot?.bbox ? JSON.stringify(placeSnapshot.bbox) : null,
            placeSnapshot?.resolvedAt ?? null,
          ],
        );
        const place = placeRows[0];

        const masterRows = await tx.query(
          `
            INSERT INTO ${MASTER_GUIDES_TABLE} (
              place_id,
              source_language,
              editorial_status
            )
            VALUES ($1, $2, $3)
            RETURNING *
          `,
          [place.id, sourceLanguage, DEFAULT_MASTER_GUIDE_EDITORIAL_STATUS],
        );
        const masterGuide = masterRows[0];

        await tx.query(
          `
            INSERT INTO ${PRESENTATIONS_TABLE} (
              master_guide_id,
              language,
              publication_status,
              staleness_status,
              approval_status
            )
            VALUES ($1, $2, $3, $4, $5)
          `,
          [
            masterGuide.id,
            sourceLanguage,
            DEFAULT_PUBLICATION_STATUS,
            DEFAULT_STALENESS_STATUS,
            DEFAULT_APPROVAL_STATUS,
          ],
        );

        return { place, masterGuide };
      });

      Logger.info('Guide place created with master guide', {
        placeId: created.place.id,
        masterGuideId: created.masterGuide.id,
      });
      return this.transformRow(created.place, created.masterGuide);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to create guide place', error);
      throw new AppError('Failed to create place', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async update(req, placeId, data) {
    try {
      const db = Database.get(req);
      const existing = await this.getById(req, placeId);

      const displayName = sanitizeDisplayName(data.displayName);
      const shortIntro = sanitizeOptionalText(data.shortIntro, 5000);
      const lifecycleStatus = parseLifecycleStatus(data.lifecycleStatus);
      if (lifecycleStatus === 'active' && existing.lifecycleStatus !== 'active') {
        await this._assertPlaceHasPublishablePresentation(db, placeId);
      }

      // Place snapshot: undefined = keep existing; null = clear; object = replace.
      // Normalize both paths to DB-field shape (existing.place uses API shape).
      const placeSnapshot =
        data.place !== undefined
          ? sanitizePlaceSnapshot(data.place)
          : sanitizePlaceSnapshot(existing.place);
      const placeChanged = data.place !== undefined;

      let geographicReference = sanitizeOptionalText(data.geographicReference, 255);
      if (data.geographicReference === undefined) {
        geographicReference =
          placeChanged && placeSnapshot
            ? (placeSnapshot.formattedAddress || placeSnapshot.displayName || '')
                .toString()
                .slice(0, 255) || null
            : (existing.geographicReference ?? null);
      }

      const rows = await db.query(
        `
          UPDATE ${PLACES_TABLE}
          SET
            display_name = $1,
            short_intro = $2,
            geographic_reference = $3,
            lifecycle_status = $4,
            place_provider = $6,
            place_provider_ref = $7,
            resolved_name = $8,
            formatted_address = $9,
            latitude = $10,
            longitude = $11,
            country_code = $12,
            admin_area = $13,
            locality = $14,
            place_types = $15::jsonb,
            bbox = $16::jsonb,
            place_resolved_at = $17,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $5
          RETURNING *
        `,
        [
          displayName,
          shortIntro,
          geographicReference,
          lifecycleStatus,
          placeId,
          placeSnapshot?.provider ?? null,
          placeSnapshot?.providerRef ?? null,
          placeSnapshot?.displayName ?? null,
          placeSnapshot?.formattedAddress ?? null,
          placeSnapshot?.latitude ?? null,
          placeSnapshot?.longitude ?? null,
          placeSnapshot?.countryCode ?? null,
          placeSnapshot?.adminArea ?? null,
          placeSnapshot?.locality ?? null,
          placeSnapshot?.placeTypes ? JSON.stringify(placeSnapshot.placeTypes) : null,
          placeSnapshot?.bbox ? JSON.stringify(placeSnapshot.bbox) : null,
          placeSnapshot?.resolvedAt ?? null,
        ],
      );

      const hasMasterGuideUpdates =
        data.sourceLanguage !== undefined || data.masterGuideEditorialStatus !== undefined;

      let masterGuide = null;
      if (hasMasterGuideUpdates) {
        const sourceLanguage =
          data.sourceLanguage !== undefined
            ? parseSourceLanguage(data.sourceLanguage)
            : existing.sourceLanguage;
        const editorialStatus =
          data.masterGuideEditorialStatus !== undefined
            ? parseMasterGuideEditorialStatus(data.masterGuideEditorialStatus)
            : existing.masterGuideEditorialStatus;

        const masterRows = await db.query(
          `
            UPDATE ${MASTER_GUIDES_TABLE} mg
            SET
              source_language = $1,
              editorial_status = $2,
              updated_at = CURRENT_TIMESTAMP
            FROM ${PLACES_TABLE} p
            WHERE mg.place_id = p.id AND mg.place_id = $3
            RETURNING mg.*
          `,
          [sourceLanguage, editorialStatus, placeId],
        );
        masterGuide = masterRows[0];
      } else {
        const masterRows = await db.query(
          `
            SELECT mg.*
            FROM ${MASTER_GUIDES_TABLE} mg
            INNER JOIN ${PLACES_TABLE} p ON p.id = mg.place_id
            WHERE mg.place_id = $1
          `,
          [placeId],
        );
        masterGuide = masterRows[0];
      }

      Logger.info('Guide place updated', { placeId });
      return this.transformRow(rows[0], masterGuide);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to update guide place', error, { placeId });
      throw new AppError('Failed to update place', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async delete(req, placeId) {
    try {
      const db = Database.get(req);
      const rows = await db.query(
        `
          DELETE FROM ${PLACES_TABLE}
          WHERE id = $1
          RETURNING id
        `,
        [placeId],
      );
      if (!rows.length) {
        throw new AppError('Place not found', 404, AppError.CODES.NOT_FOUND);
      }
      Logger.info('Guide place deleted', { placeId });
      return { id: String(placeId) };
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to delete guide place', error, { placeId });
      throw new AppError('Failed to delete place', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  transformPresentationRow(row, placeId, masterGuideId) {
    if (!row) return null;
    return {
      id: String(row.id),
      masterGuideId: String(masterGuideId ?? row.master_guide_id),
      placeId: String(placeId),
      language: row.language ?? DEFAULT_SOURCE_LANGUAGE,
      presentationText: row.presentation_text ?? null,
      publicationStatus: row.publication_status ?? DEFAULT_PUBLICATION_STATUS,
      stalenessStatus: row.staleness_status ?? DEFAULT_STALENESS_STATUS,
      approvalStatus: row.approval_status ?? DEFAULT_APPROVAL_STATUS,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async _getMasterGuideForPlace(req, placeId) {
    const db = Database.get(req);
    const rows = await db.query(
      `
        SELECT mg.id, mg.source_language
        FROM ${MASTER_GUIDES_TABLE} mg
        INNER JOIN ${PLACES_TABLE} p ON p.id = mg.place_id
        WHERE mg.place_id = $1
      `,
      [placeId],
    );
    if (!rows.length) {
      throw new AppError('Place not found', 404, AppError.CODES.NOT_FOUND);
    }
    return {
      id: rows[0].id,
      sourceLanguage: rows[0].source_language ?? DEFAULT_SOURCE_LANGUAGE,
    };
  }

  async getPresentations(req, placeId) {
    try {
      const masterGuide = await this._getMasterGuideForPlace(req, placeId);
      const db = Database.get(req);
      const rows = await db.query(
        `
          SELECT gp.*
          FROM ${PRESENTATIONS_TABLE} gp
          INNER JOIN ${MASTER_GUIDES_TABLE} mg ON mg.id = gp.master_guide_id
          INNER JOIN ${PLACES_TABLE} p ON p.id = mg.place_id
          WHERE mg.place_id = $1
          ORDER BY gp.language ASC, gp.id ASC
        `,
        [placeId],
      );
      return rows.map((row) => this.transformPresentationRow(row, placeId, masterGuide.id));
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to fetch guide presentations', error, { placeId });
      throw new AppError('Failed to fetch presentations', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async getPresentationByLanguage(req, placeId, language) {
    try {
      const masterGuide = await this._getMasterGuideForPlace(req, placeId);
      const normalizedLanguage = parseLanguage(language);
      const db = Database.get(req);
      const rows = await db.query(
        `
          SELECT gp.*
          FROM ${PRESENTATIONS_TABLE} gp
          INNER JOIN ${MASTER_GUIDES_TABLE} mg ON mg.id = gp.master_guide_id
          INNER JOIN ${PLACES_TABLE} p ON p.id = mg.place_id
          WHERE mg.place_id = $1 AND gp.language = $2
        `,
        [placeId, normalizedLanguage],
      );
      if (!rows.length) {
        throw new AppError('Presentation not found', 404, AppError.CODES.NOT_FOUND);
      }
      return this.transformPresentationRow(rows[0], placeId, masterGuide.id);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to fetch guide presentation', error, { placeId, language });
      throw new AppError('Failed to fetch presentation', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async getPresentationById(req, placeId, presentationId) {
    try {
      const masterGuide = await this._getMasterGuideForPlace(req, placeId);
      const db = Database.get(req);
      const rows = await db.query(
        `
          SELECT gp.*
          FROM ${PRESENTATIONS_TABLE} gp
          INNER JOIN ${MASTER_GUIDES_TABLE} mg ON mg.id = gp.master_guide_id
          INNER JOIN ${PLACES_TABLE} p ON p.id = mg.place_id
          WHERE mg.place_id = $1 AND gp.id = $2
        `,
        [placeId, presentationId],
      );
      if (!rows.length) {
        throw new AppError('Presentation not found', 404, AppError.CODES.NOT_FOUND);
      }
      return this.transformPresentationRow(rows[0], placeId, masterGuide.id);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to fetch guide presentation', error, { placeId, presentationId });
      throw new AppError('Failed to fetch presentation', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async ensureSourceLanguagePresentation(req, placeId) {
    const masterGuide = await this._getMasterGuideForPlace(req, placeId);
    return this.ensurePresentationForLanguage(req, placeId, masterGuide.sourceLanguage);
  }

  /**
   * Ensure an empty presentation row exists for the given language (idempotent).
   * @param {import('express').Request} req
   * @param {string} placeId
   * @param {string} language
   */
  async ensurePresentationForLanguage(req, placeId, language) {
    try {
      const masterGuide = await this._getMasterGuideForPlace(req, placeId);
      const normalizedLanguage = parseLanguage(language);

      try {
        return await this.getPresentationByLanguage(req, placeId, normalizedLanguage);
      } catch (error) {
        if (!(error instanceof AppError) || error.statusCode !== 404) {
          throw error;
        }
      }

      const db = Database.get(req);
      try {
        const rows = await db.query(
          `
            INSERT INTO ${PRESENTATIONS_TABLE} (
              master_guide_id,
              language,
              publication_status,
              staleness_status,
              approval_status
            )
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
          `,
          [
            masterGuide.id,
            normalizedLanguage,
            DEFAULT_PUBLICATION_STATUS,
            DEFAULT_STALENESS_STATUS,
            DEFAULT_APPROVAL_STATUS,
          ],
        );
        Logger.info('Guide presentation ensured for language', {
          placeId,
          presentationId: rows[0].id,
          language: normalizedLanguage,
        });
        return this.transformPresentationRow(rows[0], placeId, masterGuide.id);
      } catch (error) {
        if (error.code === '23505') {
          return this.getPresentationByLanguage(req, placeId, normalizedLanguage);
        }
        throw error;
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to ensure guide presentation for language', error, {
        placeId,
        language,
      });
      throw new AppError(
        'Failed to ensure presentation for language',
        500,
        AppError.CODES.DATABASE_ERROR,
      );
    }
  }

  async updatePresentation(req, placeId, language, data) {
    try {
      const existing = await this.getPresentationByLanguage(req, placeId, language);
      const presentationText =
        data.presentationText !== undefined
          ? sanitizePresentationText(data.presentationText)
          : existing.presentationText;
      const publicationStatus =
        data.publicationStatus !== undefined
          ? parsePublicationStatus(data.publicationStatus)
          : existing.publicationStatus;

      const presentationChanged =
        data.presentationText !== undefined &&
        !narrativesEqual(presentationText, existing.presentationText);
      // Saving presentation text (including unchanged text from the editor) marks content approved.
      const approvalStatus =
        presentationChanged || data.presentationText !== undefined
          ? 'approved'
          : (existing.approvalStatus ?? DEFAULT_APPROVAL_STATUS);

      if (publicationStatus === 'published') {
        if (approvalStatus !== 'approved' || existing.stalenessStatus !== 'fresh') {
          throw new AppError(
            'published requires approved content and fresh staleness',
            400,
            AppError.CODES.VALIDATION_ERROR,
          );
        }
      }

      const normalizedLanguage = parseLanguage(language);
      const db = Database.get(req);
      const rows = await db.query(
        `
          UPDATE ${PRESENTATIONS_TABLE} gp
          SET
            presentation_text = $1,
            publication_status = $2,
            approval_status = $3,
            updated_at = CURRENT_TIMESTAMP
          FROM ${MASTER_GUIDES_TABLE} mg
          INNER JOIN ${PLACES_TABLE} p ON p.id = mg.place_id
          WHERE gp.master_guide_id = mg.id
            AND gp.language = $4
            AND mg.place_id = $5
          RETURNING gp.*
        `,
        [presentationText, publicationStatus, approvalStatus, normalizedLanguage, placeId],
      );

      if (!rows.length) {
        throw new AppError('Presentation not found', 404, AppError.CODES.NOT_FOUND);
      }

      Logger.info('Guide presentation updated', { placeId, language: normalizedLanguage });
      return this.transformPresentationRow(rows[0], placeId, existing.masterGuideId);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to update guide presentation', error, { placeId, language });
      throw new AppError('Failed to update presentation', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  /**
   * Delete a language presentation for a place.
   * Removes production job items that reference the presentation first (FK is NOT NULL).
   * @param {import('express').Request} req
   * @param {string} placeId
   * @param {string} language
   */
  async deletePresentation(req, placeId, language) {
    try {
      const existing = await this.getPresentationByLanguage(req, placeId, language);
      const normalizedLanguage = parseLanguage(language);
      const db = Database.get(req);

      await db.query(
        `
          DELETE FROM guide_production_job_items
          WHERE presentation_id = $1
        `,
        [existing.id],
      );

      const rows = await db.query(
        `
          DELETE FROM ${PRESENTATIONS_TABLE} gp
          USING ${MASTER_GUIDES_TABLE} mg
          INNER JOIN ${PLACES_TABLE} p ON p.id = mg.place_id
          WHERE gp.master_guide_id = mg.id
            AND gp.language = $1
            AND mg.place_id = $2
          RETURNING gp.id
        `,
        [normalizedLanguage, placeId],
      );

      if (!rows.length) {
        throw new AppError('Presentation not found', 404, AppError.CODES.NOT_FOUND);
      }

      Logger.info('Guide presentation deleted', {
        placeId,
        language: normalizedLanguage,
        presentationId: existing.id,
      });
      return { deleted: true, id: existing.id, language: normalizedLanguage };
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to delete guide presentation', error, { placeId, language });
      throw new AppError('Failed to delete presentation', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async applyProductionPresentationText(req, placeId, presentationId, presentationText) {
    const db = Database.get(req);
    const rows = await db.query(
      `
        UPDATE ${PRESENTATIONS_TABLE} gp
        SET
          presentation_text = $1,
          approval_status = 'approved',
          updated_at = CURRENT_TIMESTAMP
        FROM ${MASTER_GUIDES_TABLE} mg
        INNER JOIN ${PLACES_TABLE} p ON p.id = mg.place_id
        WHERE gp.master_guide_id = mg.id
          AND gp.id = $2
          AND mg.place_id = $3
        RETURNING gp.*
      `,
      [presentationText, presentationId, placeId],
    );
    if (!rows.length) {
      throw new AppError('Presentation not found', 404, AppError.CODES.NOT_FOUND);
    }
    return this.transformPresentationRow(rows[0], placeId, rows[0].master_guide_id);
  }

  async _assertPlaceHasPublishablePresentation(db, placeId) {
    const rows = await db.query(
      `
        SELECT 1
        FROM ${PRESENTATIONS_TABLE} gp
        INNER JOIN ${MASTER_GUIDES_TABLE} mg ON mg.id = gp.master_guide_id
        INNER JOIN ${PLACES_TABLE} p ON p.id = mg.place_id
        WHERE mg.place_id = $1
          AND gp.publication_status = 'published'
          AND gp.approval_status = 'approved'
          AND gp.staleness_status = 'fresh'
        LIMIT 1
      `,
      [placeId],
    );
    if (!rows.length) {
      throw new AppError(
        'active lifecycle requires at least one published, approved, and fresh presentation',
        400,
        AppError.CODES.VALIDATION_ERROR,
      );
    }
  }

  async setIngestSource(req, placeId, ingestSourceId) {
    try {
      await this.getById(req, placeId);
      const db = Database.get(req);
      const normalizedSourceId =
        ingestSourceId === null || ingestSourceId === undefined || ingestSourceId === ''
          ? null
          : String(ingestSourceId).trim();
      if (normalizedSourceId !== null && !/^\d+$/.test(normalizedSourceId)) {
        throw new AppError('Invalid ingest source id', 400, AppError.CODES.VALIDATION_ERROR);
      }

      const rows = await db.query(
        `
          UPDATE ${PLACES_TABLE}
          SET
            ingest_source_id = $1,
            ingest_run_id = CASE WHEN $1 IS NULL THEN NULL ELSE ingest_run_id END,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
          RETURNING *
        `,
        [normalizedSourceId, placeId],
      );
      if (!rows.length) {
        throw new AppError('Place not found', 404, AppError.CODES.NOT_FOUND);
      }

      const masterRows = await db.query(
        `SELECT * FROM ${MASTER_GUIDES_TABLE} WHERE place_id = $1`,
        [placeId],
      );
      Logger.info('Guide place ingest source updated', {
        placeId,
        ingestSourceId: normalizedSourceId,
      });
      return this.transformRow(rows[0], masterRows[0]);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to set guide ingest source', error, { placeId });
      throw new AppError('Failed to set ingest source', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async updateIngestRunId(req, placeId, ingestRunId) {
    try {
      const db = Database.get(req);
      const rows = await db.query(
        `
          UPDATE ${PLACES_TABLE}
          SET ingest_run_id = $1, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
          RETURNING *
        `,
        [ingestRunId, placeId],
      );
      if (!rows.length) {
        throw new AppError('Place not found', 404, AppError.CODES.NOT_FOUND);
      }
      const masterRows = await db.query(
        `SELECT * FROM ${MASTER_GUIDES_TABLE} WHERE place_id = $1`,
        [placeId],
      );
      return this.transformRow(rows[0], masterRows[0]);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to update guide ingest run id', error, { placeId });
      throw new AppError('Failed to update ingest run', 500, AppError.CODES.DATABASE_ERROR);
    }
  }
}

module.exports = GuidesModel;

// plugins/guides/model.js
const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');
const {
  DEFAULT_SOURCE_LANGUAGE,
  DEFAULT_MASTER_GUIDE_EDITORIAL_STATUS,
  DEFAULT_PUBLICATION_STATUS,
  DEFAULT_STALENESS_STATUS,
  DEFAULT_AUDIO_STATUS,
  DEFAULT_PROVIDER_KEY,
  VARIANT_TYPES,
  parseLifecycleStatus,
  parseMasterGuideEditorialStatus,
  parseGuideStopEditorialStatus,
  parseSourceLanguage,
  parseVariantType,
  parsePublicationStatus,
  parseLanguage,
  parseAudioStatus,
  parseProviderKey,
} = require('./validation');
const { sanitizeStorageRef } = require('./audio/storageRef');

const PLACES_TABLE = 'guide_places';
const MASTER_GUIDES_TABLE = 'guide_master_guides';
const STOPS_TABLE = 'guide_stops';
const VARIANTS_TABLE = 'guide_variant_presentations';
const AUDIO_TABLE = 'guide_audio';

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

function sanitizeTitle(value) {
  const trimmed = (value || '').toString().trim();
  if (!trimmed) {
    throw new AppError('Title is required', 400, AppError.CODES.VALIDATION_ERROR);
  }
  return trimmed.slice(0, 255);
}

function sanitizeCanonicalNarrative(value) {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed.slice(0, 50000) : null;
}

function sanitizePresentationText(value) {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed.slice(0, 50000) : null;
}

function sanitizeMimeType(value) {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed.slice(0, 100) : null;
}

function sanitizeErrorMessage(value) {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed.slice(0, 5000) : null;
}

function sanitizeDurationMs(value) {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new AppError(
      'durationMs must be a non-negative integer',
      400,
      AppError.CODES.VALIDATION_ERROR,
    );
  }
  return parsed;
}

function narrativesEqual(a, b) {
  return String(a ?? '') === String(b ?? '');
}

class GuidesModel {
  transformRow(placeRow, masterGuideRow) {
    if (!placeRow) return null;
    return {
      id: String(placeRow.id),
      displayName: placeRow.display_name ?? '',
      shortIntro: placeRow.short_intro ?? null,
      geographicReference: placeRow.geographic_reference ?? null,
      lifecycleStatus: placeRow.lifecycle_status ?? 'draft',
      masterGuideId: masterGuideRow ? String(masterGuideRow.id) : null,
      sourceLanguage: masterGuideRow?.source_language ?? DEFAULT_SOURCE_LANGUAGE,
      masterGuideEditorialStatus:
        masterGuideRow?.editorial_status ?? DEFAULT_MASTER_GUIDE_EDITORIAL_STATUS,
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
            mg.editorial_status AS master_editorial_status
          FROM ${PLACES_TABLE} p
          INNER JOIN ${MASTER_GUIDES_TABLE} mg ON mg.place_id = p.id
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
            mg.editorial_status AS master_editorial_status
          FROM ${PLACES_TABLE} p
          INNER JOIN ${MASTER_GUIDES_TABLE} mg ON mg.place_id = p.id
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
      const geographicReference = sanitizeOptionalText(data.geographicReference, 255);
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
              lifecycle_status
            )
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
          `,
          [userId, displayName, shortIntro, geographicReference, lifecycleStatus],
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

        return { place, masterGuide: masterRows[0] };
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
      const geographicReference = sanitizeOptionalText(data.geographicReference, 255);
      const lifecycleStatus = parseLifecycleStatus(data.lifecycleStatus);

      const rows = await db.query(
        `
          UPDATE ${PLACES_TABLE}
          SET
            display_name = $1,
            short_intro = $2,
            geographic_reference = $3,
            lifecycle_status = $4,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $5
          RETURNING *
        `,
        [displayName, shortIntro, geographicReference, lifecycleStatus, placeId],
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

  transformStopRow(row, placeId, masterGuideId) {
    if (!row) return null;
    return {
      id: String(row.id),
      masterGuideId: String(masterGuideId ?? row.master_guide_id),
      placeId: String(placeId),
      title: row.title ?? '',
      sequenceOrder: row.sequence_order,
      canonicalNarrative: row.canonical_narrative ?? null,
      editorialStatus: row.editorial_status ?? DEFAULT_MASTER_GUIDE_EDITORIAL_STATUS,
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

  async _insertDefaultVariants(tx, stopId, sourceLanguage) {
    for (const variantType of VARIANT_TYPES) {
      await tx.query(
        `
          INSERT INTO ${VARIANTS_TABLE} (
            stop_id,
            variant_type,
            language,
            publication_status,
            staleness_status
          )
          VALUES ($1, $2, $3, $4, $5)
        `,
        [stopId, variantType, sourceLanguage, DEFAULT_PUBLICATION_STATUS, DEFAULT_STALENESS_STATUS],
      );
    }
  }

  async _markVariantsStaleForStop(db, stopId, placeId) {
    await db.query(
      `
        UPDATE ${VARIANTS_TABLE} gvp
        SET
          staleness_status = 'stale',
          updated_at = CURRENT_TIMESTAMP
        FROM ${STOPS_TABLE} gs
        INNER JOIN ${MASTER_GUIDES_TABLE} mg ON mg.id = gs.master_guide_id
        INNER JOIN ${PLACES_TABLE} p ON p.id = mg.place_id
        WHERE gvp.stop_id = gs.id
          AND gs.id = $1
          AND mg.place_id = $2
          AND gvp.staleness_status <> 'stale'
      `,
      [stopId, placeId],
    );
    await this._markAudioStaleForStop(db, stopId, placeId);
  }

  async _markAudioStaleForStop(db, stopId, placeId) {
    await db.query(
      `
        UPDATE ${AUDIO_TABLE} ga
        SET
          status = 'stale',
          updated_at = CURRENT_TIMESTAMP
        FROM ${VARIANTS_TABLE} gvp
        INNER JOIN ${STOPS_TABLE} gs ON gs.id = gvp.stop_id
        INNER JOIN ${MASTER_GUIDES_TABLE} mg ON mg.id = gs.master_guide_id
        INNER JOIN ${PLACES_TABLE} p ON p.id = mg.place_id
        WHERE ga.variant_presentation_id = gvp.id
          AND gs.id = $1
          AND mg.place_id = $2
          AND ga.status <> 'stale'
      `,
      [stopId, placeId],
    );
  }

  async getStops(req, placeId) {
    try {
      const masterGuide = await this._getMasterGuideForPlace(req, placeId);
      const db = Database.get(req);
      const rows = await db.query(
        `
          SELECT gs.*
          FROM ${STOPS_TABLE} gs
          INNER JOIN ${MASTER_GUIDES_TABLE} mg ON mg.id = gs.master_guide_id
          INNER JOIN ${PLACES_TABLE} p ON p.id = mg.place_id
          WHERE mg.place_id = $1
          ORDER BY gs.sequence_order ASC, gs.id ASC
        `,
        [placeId],
      );
      return rows.map((row) => this.transformStopRow(row, placeId, masterGuide.id));
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to fetch guide stops', error, { placeId });
      throw new AppError('Failed to fetch stops', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async getStopById(req, placeId, stopId) {
    try {
      const masterGuide = await this._getMasterGuideForPlace(req, placeId);
      const db = Database.get(req);
      const rows = await db.query(
        `
          SELECT gs.*
          FROM ${STOPS_TABLE} gs
          INNER JOIN ${MASTER_GUIDES_TABLE} mg ON mg.id = gs.master_guide_id
          INNER JOIN ${PLACES_TABLE} p ON p.id = mg.place_id
          WHERE mg.place_id = $1 AND gs.id = $2
        `,
        [placeId, stopId],
      );
      if (!rows.length) {
        throw new AppError('Stop not found', 404, AppError.CODES.NOT_FOUND);
      }
      return this.transformStopRow(rows[0], placeId, masterGuide.id);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to fetch guide stop', error, { placeId, stopId });
      throw new AppError('Failed to fetch stop', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async createStop(req, placeId, data) {
    try {
      const masterGuide = await this._getMasterGuideForPlace(req, placeId);
      const db = Database.get(req);
      const title = sanitizeTitle(data.title);
      const canonicalNarrative = sanitizeCanonicalNarrative(data.canonicalNarrative);
      const editorialStatus = parseGuideStopEditorialStatus(data.editorialStatus);

      const created = await db.transaction(async (tx) => {
        const orderRows = await tx.query(
          `
            SELECT COALESCE(MAX(gs.sequence_order), 0) + 1 AS next_order
            FROM ${STOPS_TABLE} gs
            WHERE gs.master_guide_id = $1
          `,
          [masterGuide.id],
        );
        const sequenceOrder = orderRows[0].next_order;

        const rows = await tx.query(
          `
            INSERT INTO ${STOPS_TABLE} (
              master_guide_id,
              title,
              sequence_order,
              canonical_narrative,
              editorial_status
            )
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
          `,
          [masterGuide.id, title, sequenceOrder, canonicalNarrative, editorialStatus],
        );
        const stop = rows[0];
        await this._insertDefaultVariants(tx, stop.id, masterGuide.sourceLanguage);
        return stop;
      });

      Logger.info('Guide stop created', {
        placeId,
        stopId: created.id,
        masterGuideId: masterGuide.id,
      });
      return this.transformStopRow(created, placeId, masterGuide.id);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to create guide stop', error, { placeId });
      throw new AppError('Failed to create stop', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async updateStop(req, placeId, stopId, data) {
    try {
      const existing = await this.getStopById(req, placeId, stopId);
      const title = data.title !== undefined ? sanitizeTitle(data.title) : existing.title;
      const canonicalNarrative =
        data.canonicalNarrative !== undefined
          ? sanitizeCanonicalNarrative(data.canonicalNarrative)
          : existing.canonicalNarrative;
      const editorialStatus =
        data.editorialStatus !== undefined
          ? parseGuideStopEditorialStatus(data.editorialStatus)
          : existing.editorialStatus;
      const narrativeChanged =
        data.canonicalNarrative !== undefined &&
        !narrativesEqual(canonicalNarrative, existing.canonicalNarrative);

      const db = Database.get(req);
      const rows = await db.query(
        `
          UPDATE ${STOPS_TABLE} gs
          SET
            title = $1,
            canonical_narrative = $2,
            editorial_status = $3,
            updated_at = CURRENT_TIMESTAMP
          FROM ${MASTER_GUIDES_TABLE} mg
          INNER JOIN ${PLACES_TABLE} p ON p.id = mg.place_id
          WHERE gs.master_guide_id = mg.id
            AND gs.id = $4
            AND mg.place_id = $5
          RETURNING gs.*
        `,
        [title, canonicalNarrative, editorialStatus, stopId, placeId],
      );

      if (!rows.length) {
        throw new AppError('Stop not found', 404, AppError.CODES.NOT_FOUND);
      }

      if (narrativeChanged) {
        await this._markVariantsStaleForStop(db, stopId, placeId);
      }

      Logger.info('Guide stop updated', { placeId, stopId, narrativeChanged });
      return this.transformStopRow(rows[0], placeId, existing.masterGuideId);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to update guide stop', error, { placeId, stopId });
      throw new AppError('Failed to update stop', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async deleteStop(req, placeId, stopId) {
    try {
      await this.getStopById(req, placeId, stopId);
      const db = Database.get(req);
      const rows = await db.query(
        `
          DELETE FROM ${STOPS_TABLE} gs
          USING ${MASTER_GUIDES_TABLE} mg, ${PLACES_TABLE} p
          WHERE gs.master_guide_id = mg.id
            AND mg.place_id = p.id
            AND gs.id = $1
            AND mg.place_id = $2
          RETURNING gs.id
        `,
        [stopId, placeId],
      );
      if (!rows.length) {
        throw new AppError('Stop not found', 404, AppError.CODES.NOT_FOUND);
      }
      Logger.info('Guide stop deleted', { placeId, stopId });
      return { id: String(stopId) };
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to delete guide stop', error, { placeId, stopId });
      throw new AppError('Failed to delete stop', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async reorderStops(req, placeId, stopIds) {
    try {
      if (!Array.isArray(stopIds) || stopIds.length === 0) {
        throw new AppError(
          'stopIds must be a non-empty array',
          400,
          AppError.CODES.VALIDATION_ERROR,
        );
      }

      const normalizedIds = stopIds.map((id) => String(id).trim());
      if (normalizedIds.some((id) => !/^\d+$/.test(id))) {
        throw new AppError('Invalid stop id in stopIds', 400, AppError.CODES.VALIDATION_ERROR);
      }
      if (new Set(normalizedIds).size !== normalizedIds.length) {
        throw new AppError(
          'stopIds must not contain duplicates',
          400,
          AppError.CODES.VALIDATION_ERROR,
        );
      }

      const masterGuide = await this._getMasterGuideForPlace(req, placeId);
      const db = Database.get(req);
      const existingRows = await db.query(
        `
          SELECT gs.id
          FROM ${STOPS_TABLE} gs
          INNER JOIN ${MASTER_GUIDES_TABLE} mg ON mg.id = gs.master_guide_id
          INNER JOIN ${PLACES_TABLE} p ON p.id = mg.place_id
          WHERE mg.place_id = $1
          ORDER BY gs.sequence_order ASC, gs.id ASC
        `,
        [placeId],
      );

      const existingIds = existingRows.map((row) => String(row.id));
      if (existingIds.length !== normalizedIds.length) {
        throw new AppError(
          'stopIds must include every stop for this place',
          400,
          AppError.CODES.VALIDATION_ERROR,
        );
      }

      const existingSet = new Set(existingIds);
      for (const id of normalizedIds) {
        if (!existingSet.has(id)) {
          throw new AppError(
            'stopIds contains unknown stop for this place',
            400,
            AppError.CODES.VALIDATION_ERROR,
          );
        }
      }

      await db.transaction(async (tx) => {
        for (let i = 0; i < normalizedIds.length; i++) {
          await tx.query(
            `
              UPDATE ${STOPS_TABLE} gs
              SET sequence_order = $1, updated_at = CURRENT_TIMESTAMP
              FROM ${MASTER_GUIDES_TABLE} mg
              INNER JOIN ${PLACES_TABLE} p ON p.id = mg.place_id
              WHERE gs.master_guide_id = mg.id
                AND gs.id = $2
                AND mg.place_id = $3
            `,
            [-(i + 1), normalizedIds[i], placeId],
          );
        }
        for (let i = 0; i < normalizedIds.length; i++) {
          await tx.query(
            `
              UPDATE ${STOPS_TABLE} gs
              SET sequence_order = $1, updated_at = CURRENT_TIMESTAMP
              FROM ${MASTER_GUIDES_TABLE} mg
              INNER JOIN ${PLACES_TABLE} p ON p.id = mg.place_id
              WHERE gs.master_guide_id = mg.id
                AND gs.id = $2
                AND mg.place_id = $3
            `,
            [i + 1, normalizedIds[i], placeId],
          );
        }
      });

      Logger.info('Guide stops reordered', { placeId, masterGuideId: masterGuide.id });
      return this.getStops(req, placeId);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to reorder guide stops', error, { placeId });
      throw new AppError('Failed to reorder stops', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  transformVariantRow(row, placeId, stopId) {
    if (!row) return null;
    return {
      id: String(row.id),
      stopId: String(stopId ?? row.stop_id),
      placeId: String(placeId),
      variantType: row.variant_type ?? 'normal',
      language: row.language ?? DEFAULT_SOURCE_LANGUAGE,
      presentationText: row.presentation_text ?? null,
      publicationStatus: row.publication_status ?? DEFAULT_PUBLICATION_STATUS,
      stalenessStatus: row.staleness_status ?? DEFAULT_STALENESS_STATUS,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getVariants(req, placeId, stopId) {
    try {
      await this.getStopById(req, placeId, stopId);
      const db = Database.get(req);
      const rows = await db.query(
        `
          SELECT gvp.*
          FROM ${VARIANTS_TABLE} gvp
          INNER JOIN ${STOPS_TABLE} gs ON gs.id = gvp.stop_id
          INNER JOIN ${MASTER_GUIDES_TABLE} mg ON mg.id = gs.master_guide_id
          INNER JOIN ${PLACES_TABLE} p ON p.id = mg.place_id
          WHERE gvp.stop_id = $1 AND mg.place_id = $2
          ORDER BY gvp.variant_type ASC, gvp.language ASC, gvp.id ASC
        `,
        [stopId, placeId],
      );
      return rows.map((row) => this.transformVariantRow(row, placeId, stopId));
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to fetch guide variants', error, { placeId, stopId });
      throw new AppError('Failed to fetch variants', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async getVariantById(req, placeId, stopId, variantId) {
    try {
      const db = Database.get(req);
      const rows = await db.query(
        `
          SELECT gvp.*
          FROM ${VARIANTS_TABLE} gvp
          INNER JOIN ${STOPS_TABLE} gs ON gs.id = gvp.stop_id
          INNER JOIN ${MASTER_GUIDES_TABLE} mg ON mg.id = gs.master_guide_id
          INNER JOIN ${PLACES_TABLE} p ON p.id = mg.place_id
          WHERE gvp.id = $1 AND gvp.stop_id = $2 AND mg.place_id = $3
        `,
        [variantId, stopId, placeId],
      );
      if (!rows.length) {
        throw new AppError('Variant not found', 404, AppError.CODES.NOT_FOUND);
      }
      return this.transformVariantRow(rows[0], placeId, stopId);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to fetch guide variant', error, { placeId, stopId, variantId });
      throw new AppError('Failed to fetch variant', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async createVariant(req, placeId, stopId, data) {
    try {
      await this.getStopById(req, placeId, stopId);
      const variantType = parseVariantType(data.variantType);
      const language = parseLanguage(data.language);
      const presentationText = sanitizePresentationText(data.presentationText);
      const publicationStatus = parsePublicationStatus(data.publicationStatus);

      const db = Database.get(req);
      try {
        const rows = await db.query(
          `
            INSERT INTO ${VARIANTS_TABLE} (
              stop_id,
              variant_type,
              language,
              presentation_text,
              publication_status,
              staleness_status
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
          `,
          [
            stopId,
            variantType,
            language,
            presentationText,
            publicationStatus,
            DEFAULT_STALENESS_STATUS,
          ],
        );

        Logger.info('Guide variant created', { placeId, stopId, variantId: rows[0].id });
        return this.transformVariantRow(rows[0], placeId, stopId);
      } catch (error) {
        if (error.code === '23505') {
          throw new AppError(
            'Variant already exists for this stop, type, and language',
            409,
            AppError.CODES.CONFLICT,
          );
        }
        throw error;
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to create guide variant', error, { placeId, stopId });
      throw new AppError('Failed to create variant', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async updateVariant(req, placeId, stopId, variantId, data) {
    try {
      const existing = await this.getVariantById(req, placeId, stopId, variantId);
      const presentationText =
        data.presentationText !== undefined
          ? sanitizePresentationText(data.presentationText)
          : existing.presentationText;
      const publicationStatus =
        data.publicationStatus !== undefined
          ? parsePublicationStatus(data.publicationStatus)
          : existing.publicationStatus;

      const db = Database.get(req);
      const rows = await db.query(
        `
          UPDATE ${VARIANTS_TABLE} gvp
          SET
            presentation_text = $1,
            publication_status = $2,
            updated_at = CURRENT_TIMESTAMP
          FROM ${STOPS_TABLE} gs
          INNER JOIN ${MASTER_GUIDES_TABLE} mg ON mg.id = gs.master_guide_id
          INNER JOIN ${PLACES_TABLE} p ON p.id = mg.place_id
          WHERE gvp.stop_id = gs.id
            AND gvp.id = $3
            AND gvp.stop_id = $4
            AND mg.place_id = $5
          RETURNING gvp.*
        `,
        [presentationText, publicationStatus, variantId, stopId, placeId],
      );

      if (!rows.length) {
        throw new AppError('Variant not found', 404, AppError.CODES.NOT_FOUND);
      }

      Logger.info('Guide variant updated', { placeId, stopId, variantId });
      return this.transformVariantRow(rows[0], placeId, stopId);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to update guide variant', error, { placeId, stopId, variantId });
      throw new AppError('Failed to update variant', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async deleteVariant(req, placeId, stopId, variantId) {
    try {
      await this.getVariantById(req, placeId, stopId, variantId);
      const db = Database.get(req);
      const rows = await db.query(
        `
          DELETE FROM ${VARIANTS_TABLE} gvp
          USING ${STOPS_TABLE} gs, ${MASTER_GUIDES_TABLE} mg, ${PLACES_TABLE} p
          WHERE gvp.stop_id = gs.id
            AND gs.master_guide_id = mg.id
            AND mg.place_id = p.id
            AND gvp.id = $1
            AND gvp.stop_id = $2
            AND mg.place_id = $3
          RETURNING gvp.id
        `,
        [variantId, stopId, placeId],
      );
      if (!rows.length) {
        throw new AppError('Variant not found', 404, AppError.CODES.NOT_FOUND);
      }
      Logger.info('Guide variant deleted', { placeId, stopId, variantId });
      return { id: String(variantId) };
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to delete guide variant', error, { placeId, stopId, variantId });
      throw new AppError('Failed to delete variant', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  transformAudioRow(row, placeId, stopId, variantId) {
    if (!row) return null;
    return {
      id: String(row.id),
      variantId: String(variantId ?? row.variant_presentation_id),
      stopId: String(stopId),
      placeId: String(placeId),
      status: row.status ?? DEFAULT_AUDIO_STATUS,
      providerKey: row.provider_key ?? DEFAULT_PROVIDER_KEY,
      storageRef: row.storage_ref ?? null,
      durationMs: row.duration_ms ?? null,
      mimeType: row.mime_type ?? null,
      errorMessage: row.error_message ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getAudioIfExists(req, placeId, stopId, variantId) {
    try {
      return await this.getAudio(req, placeId, stopId, variantId);
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async setAudioGenerationState(req, placeId, stopId, variantId, state) {
    try {
      await this.getVariantById(req, placeId, stopId, variantId);
      const db = Database.get(req);
      const rows = await db.query(
        `
          UPDATE ${AUDIO_TABLE} ga
          SET
            status = $1,
            storage_ref = $2,
            duration_ms = $3,
            mime_type = $4,
            error_message = $5,
            updated_at = CURRENT_TIMESTAMP
          FROM ${VARIANTS_TABLE} gvp
          INNER JOIN ${STOPS_TABLE} gs ON gs.id = gvp.stop_id
          INNER JOIN ${MASTER_GUIDES_TABLE} mg ON mg.id = gs.master_guide_id
          INNER JOIN ${PLACES_TABLE} p ON p.id = mg.place_id
          WHERE ga.variant_presentation_id = gvp.id
            AND ga.variant_presentation_id = $6
            AND gvp.stop_id = $7
            AND mg.place_id = $8
          RETURNING ga.*
        `,
        [
          state.status,
          state.storageRef ?? null,
          state.durationMs ?? null,
          state.mimeType ?? null,
          state.errorMessage ?? null,
          variantId,
          stopId,
          placeId,
        ],
      );

      if (!rows.length) {
        throw new AppError('Audio not found', 404, AppError.CODES.NOT_FOUND);
      }

      return this.transformAudioRow(rows[0], placeId, stopId, variantId);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to update guide audio generation state', error, {
        placeId,
        stopId,
        variantId,
      });
      throw new AppError('Failed to update audio', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async deleteAudioRecord(req, placeId, stopId, variantId) {
    try {
      await this.getVariantById(req, placeId, stopId, variantId);
      const db = Database.get(req);
      const rows = await db.query(
        `
          DELETE FROM ${AUDIO_TABLE} ga
          USING ${VARIANTS_TABLE} gvp, ${STOPS_TABLE} gs, ${MASTER_GUIDES_TABLE} mg, ${PLACES_TABLE} p
          WHERE ga.variant_presentation_id = gvp.id
            AND gvp.stop_id = gs.id
            AND gs.master_guide_id = mg.id
            AND mg.place_id = p.id
            AND ga.variant_presentation_id = $1
            AND gvp.stop_id = $2
            AND mg.place_id = $3
          RETURNING ga.id
        `,
        [variantId, stopId, placeId],
      );
      if (!rows.length) {
        throw new AppError('Audio not found', 404, AppError.CODES.NOT_FOUND);
      }
      Logger.info('Guide audio deleted', { placeId, stopId, variantId });
      return { id: String(rows[0].id) };
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to delete guide audio', error, { placeId, stopId, variantId });
      throw new AppError('Failed to delete audio', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async getAudio(req, placeId, stopId, variantId) {
    try {
      await this.getVariantById(req, placeId, stopId, variantId);
      const db = Database.get(req);
      const rows = await db.query(
        `
          SELECT ga.*
          FROM ${AUDIO_TABLE} ga
          INNER JOIN ${VARIANTS_TABLE} gvp ON gvp.id = ga.variant_presentation_id
          INNER JOIN ${STOPS_TABLE} gs ON gs.id = gvp.stop_id
          INNER JOIN ${MASTER_GUIDES_TABLE} mg ON mg.id = gs.master_guide_id
          INNER JOIN ${PLACES_TABLE} p ON p.id = mg.place_id
          WHERE ga.variant_presentation_id = $1
            AND gvp.stop_id = $2
            AND mg.place_id = $3
        `,
        [variantId, stopId, placeId],
      );
      if (!rows.length) {
        throw new AppError('Audio not found', 404, AppError.CODES.NOT_FOUND);
      }
      return this.transformAudioRow(rows[0], placeId, stopId, variantId);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to fetch guide audio', error, { placeId, stopId, variantId });
      throw new AppError('Failed to fetch audio', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async createAudio(req, placeId, stopId, variantId, data) {
    try {
      await this.getVariantById(req, placeId, stopId, variantId);
      const status = parseAudioStatus(data.status);
      const providerKey = parseProviderKey(data.providerKey);
      const storageRef = sanitizeStorageRef(data.storageRef);
      const durationMs = data.durationMs !== undefined ? sanitizeDurationMs(data.durationMs) : null;
      const mimeType = sanitizeMimeType(data.mimeType);
      const errorMessage = sanitizeErrorMessage(data.errorMessage);

      const db = Database.get(req);
      try {
        const rows = await db.query(
          `
            INSERT INTO ${AUDIO_TABLE} (
              variant_presentation_id,
              status,
              provider_key,
              storage_ref,
              duration_ms,
              mime_type,
              error_message
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
          `,
          [variantId, status, providerKey, storageRef, durationMs, mimeType, errorMessage],
        );

        Logger.info('Guide audio created', { placeId, stopId, variantId, audioId: rows[0].id });
        return this.transformAudioRow(rows[0], placeId, stopId, variantId);
      } catch (error) {
        if (error.code === '23505') {
          throw new AppError('Audio already exists for this variant', 409, AppError.CODES.CONFLICT);
        }
        throw error;
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to create guide audio', error, { placeId, stopId, variantId });
      throw new AppError('Failed to create audio', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async updateAudio(req, placeId, stopId, variantId, data) {
    try {
      const existing = await this.getAudio(req, placeId, stopId, variantId);
      if (data.status !== undefined && parseAudioStatus(data.status) === 'ready') {
        throw new AppError(
          'Use audio generate to reach ready status',
          400,
          AppError.CODES.VALIDATION_ERROR,
        );
      }
      const status = data.status !== undefined ? parseAudioStatus(data.status) : existing.status;
      const providerKey =
        data.providerKey !== undefined ? parseProviderKey(data.providerKey) : existing.providerKey;
      const storageRef =
        data.storageRef !== undefined ? sanitizeStorageRef(data.storageRef) : existing.storageRef;
      const durationMs =
        data.durationMs !== undefined ? sanitizeDurationMs(data.durationMs) : existing.durationMs;
      const mimeType =
        data.mimeType !== undefined ? sanitizeMimeType(data.mimeType) : existing.mimeType;
      const errorMessage =
        data.errorMessage !== undefined
          ? sanitizeErrorMessage(data.errorMessage)
          : existing.errorMessage;

      const db = Database.get(req);
      const rows = await db.query(
        `
          UPDATE ${AUDIO_TABLE} ga
          SET
            status = $1,
            provider_key = $2,
            storage_ref = $3,
            duration_ms = $4,
            mime_type = $5,
            error_message = $6,
            updated_at = CURRENT_TIMESTAMP
          FROM ${VARIANTS_TABLE} gvp
          INNER JOIN ${STOPS_TABLE} gs ON gs.id = gvp.stop_id
          INNER JOIN ${MASTER_GUIDES_TABLE} mg ON mg.id = gs.master_guide_id
          INNER JOIN ${PLACES_TABLE} p ON p.id = mg.place_id
          WHERE ga.variant_presentation_id = gvp.id
            AND ga.variant_presentation_id = $7
            AND gvp.stop_id = $8
            AND mg.place_id = $9
          RETURNING ga.*
        `,
        [
          status,
          providerKey,
          storageRef,
          durationMs,
          mimeType,
          errorMessage,
          variantId,
          stopId,
          placeId,
        ],
      );

      if (!rows.length) {
        throw new AppError('Audio not found', 404, AppError.CODES.NOT_FOUND);
      }

      Logger.info('Guide audio updated', { placeId, stopId, variantId });
      return this.transformAudioRow(rows[0], placeId, stopId, variantId);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to update guide audio', error, { placeId, stopId, variantId });
      throw new AppError('Failed to update audio', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async deleteAudio(req, placeId, stopId, variantId) {
    return this.deleteAudioRecord(req, placeId, stopId, variantId);
  }
}

module.exports = GuidesModel;

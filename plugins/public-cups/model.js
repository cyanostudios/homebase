const { Logger } = require('@homebase/core');

class PublicCupsModel {
  transformCup(row) {
    return {
      id: String(row.id),
      name: row.name ?? '',
      organizer: row.organizer ?? null,
      location: row.location ?? null,
      start_date: row.start_date ?? null,
      end_date: row.end_date ?? null,
      categories: row.categories ?? null,
      featured: row.featured === true || row.featured === 'true',
      sanctioned: row.sanctioned !== false && row.sanctioned !== 'false',
      team_count:
        row.team_count !== null &&
        row.team_count !== undefined &&
        !Number.isNaN(Number(row.team_count))
          ? Number(row.team_count)
          : null,
      match_format: row.match_format ?? null,
      registration_url: row.registration_url ?? null,
      featured_image_url: row.featured_image_url ?? null,
      description: row.description ?? null,
      source_url: row.source_url ?? null,
      source_type: row.source_type ?? null,
      ingest_source_name: row.ingest_source_name ?? null,
      updated_at: row.updated_at ?? null,
    };
  }

  async getPublicCups(pool) {
    try {
      const result = await pool.query(`
        SELECT
          c.id,
          c.name,
          c.organizer,
          c.location,
          c.start_date,
          c.end_date,
          c.categories,
          c.featured,
          c.sanctioned,
          c.team_count,
          c.match_format,
          c.registration_url,
          c.featured_image_url,
          c.description,
          c.source_url,
          c.source_type,
          c.updated_at,
          src.name AS ingest_source_name
        FROM cups c
        LEFT JOIN ingest_sources src ON src.id = c.ingest_source_id
        WHERE COALESCE(c.visible, TRUE) = TRUE
          AND c.deleted_at IS NULL
        ORDER BY c.start_date ASC NULLS LAST, c.name ASC
      `);
      return result.rows.map((row) => this.transformCup(row));
    } catch (error) {
      Logger.error('Failed to fetch public cups', error);
      throw error;
    }
  }
}

module.exports = PublicCupsModel;

// plugins/guides/__tests__/tenantFilter.test.js
const PostgreSQLAdapter = require('../../../server/core/services/database/adapters/PostgreSQLAdapter');

describe('guides tenant filter compatibility', () => {
  const adapter = new PostgreSQLAdapter(null, null);
  const userId = 42;

  test('LIST query receives user_id filter', () => {
    const sql = `
          SELECT
            p.*,
            mg.id AS master_guide_id,
            mg.source_language,
            mg.editorial_status AS master_editorial_status
          FROM guide_places p
          INNER JOIN guide_master_guides mg ON mg.place_id = p.id
          ORDER BY p.updated_at DESC, p.id DESC
        `;
    const filtered = adapter._addTenantFilter(sql, userId);
    expect(filtered).toContain('user_id = $1');
    expect(filtered).toContain('ORDER BY p.updated_at DESC');
  });

  test('GET by id query receives user_id filter', () => {
    const sql = `
          SELECT
            p.*,
            mg.id AS master_guide_id,
            mg.source_language,
            mg.editorial_status AS master_editorial_status
          FROM guide_places p
          INNER JOIN guide_master_guides mg ON mg.place_id = p.id
          WHERE p.id = $1
        `;
    const filtered = adapter._addTenantFilter(sql, userId);
    expect(filtered).toContain('WHERE p.id = $1');
    expect(filtered).toContain('AND user_id = $2');
  });

  test('UPDATE query receives user_id filter', () => {
    const sql = `
          UPDATE guide_places
          SET
            display_name = $1,
            short_intro = $2,
            geographic_reference = $3,
            lifecycle_status = $4,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $5
          RETURNING *
        `;
    const filtered = adapter._addTenantFilter(sql, userId);
    expect(filtered).toContain('WHERE id = $5');
    expect(filtered).toContain('AND user_id = $6');
    expect(filtered).toContain('RETURNING *');
  });

  test('DELETE query receives user_id filter', () => {
    const sql = `
          DELETE FROM guide_places
          WHERE id = $1
          RETURNING id
        `;
    const filtered = adapter._addTenantFilter(sql, userId);
    expect(filtered).toContain('WHERE id = $1');
    expect(filtered).toContain('AND user_id = $2');
  });

  test('master guide lookup joins guide_places for user_id scope', () => {
    const sql = `
          SELECT mg.*
          FROM guide_master_guides mg
          INNER JOIN guide_places p ON p.id = mg.place_id
          WHERE mg.place_id = $1
        `;
    const filtered = adapter._addTenantFilter(sql, userId);
    expect(filtered).toContain('INNER JOIN guide_places p');
    expect(filtered).toContain('AND user_id = $2');
  });

  test('master guide UPDATE joins guide_places for user_id scope', () => {
    const sql = `
          UPDATE guide_master_guides mg
          SET
            source_language = $1,
            editorial_status = $2,
            updated_at = CURRENT_TIMESTAMP
          FROM guide_places p
          WHERE mg.place_id = p.id AND mg.place_id = $3
          RETURNING mg.*
        `;
    const filtered = adapter._addTenantFilter(sql, userId);
    expect(filtered).toContain('FROM guide_places p');
    expect(filtered).toContain('AND user_id = $4');
    expect(filtered).toContain('RETURNING mg.*');
  });

  test('guide stop LIST joins guide_places for user_id scope', () => {
    const sql = `
          SELECT gs.*
          FROM guide_stops gs
          INNER JOIN guide_master_guides mg ON mg.id = gs.master_guide_id
          INNER JOIN guide_places p ON p.id = mg.place_id
          WHERE mg.place_id = $1
          ORDER BY gs.sequence_order ASC, gs.id ASC
        `;
    const filtered = adapter._addTenantFilter(sql, userId);
    expect(filtered).toContain('INNER JOIN guide_places p');
    expect(filtered).toContain('AND user_id = $2');
    expect(filtered).toContain('ORDER BY gs.sequence_order ASC');
  });

  test('guide stop UPDATE joins guide_places for user_id scope', () => {
    const sql = `
          UPDATE guide_stops gs
          SET
            title = $1,
            canonical_narrative = $2,
            editorial_status = $3,
            updated_at = CURRENT_TIMESTAMP
          FROM guide_master_guides mg
          INNER JOIN guide_places p ON p.id = mg.place_id
          WHERE gs.master_guide_id = mg.id
            AND gs.id = $4
            AND mg.place_id = $5
          RETURNING gs.*
        `;
    const filtered = adapter._addTenantFilter(sql, userId);
    expect(filtered).toContain('FROM guide_master_guides mg');
    expect(filtered).toContain('AND user_id = $6');
    expect(filtered).toContain('RETURNING gs.*');
  });

  test('guide stop DELETE uses guide_places for user_id scope', () => {
    const sql = `
          DELETE FROM guide_stops gs
          USING guide_master_guides mg, guide_places p
          WHERE gs.master_guide_id = mg.id
            AND mg.place_id = p.id
            AND gs.id = $1
            AND mg.place_id = $2
          RETURNING gs.id
        `;
    const filtered = adapter._addTenantFilter(sql, userId);
    expect(filtered).toContain('guide_places p');
    expect(filtered).toContain('AND user_id = $3');
    expect(filtered).toContain('RETURNING gs.id');
  });

  test('guide variant LIST joins guide_places for user_id scope', () => {
    const sql = `
          SELECT gvp.*
          FROM guide_variant_presentations gvp
          INNER JOIN guide_stops gs ON gs.id = gvp.stop_id
          INNER JOIN guide_master_guides mg ON mg.id = gs.master_guide_id
          INNER JOIN guide_places p ON p.id = mg.place_id
          WHERE gvp.stop_id = $1 AND mg.place_id = $2
          ORDER BY gvp.variant_type ASC, gvp.language ASC, gvp.id ASC
        `;
    const filtered = adapter._addTenantFilter(sql, userId);
    expect(filtered).toContain('INNER JOIN guide_places p');
    expect(filtered).toContain('AND user_id = $3');
  });

  test('guide variant UPDATE joins guide_places for user_id scope', () => {
    const sql = `
          UPDATE guide_variant_presentations gvp
          SET
            presentation_text = $1,
            publication_status = $2,
            approval_status = $3,
            updated_at = CURRENT_TIMESTAMP
          FROM guide_stops gs
          INNER JOIN guide_master_guides mg ON mg.id = gs.master_guide_id
          INNER JOIN guide_places p ON p.id = mg.place_id
          WHERE gvp.stop_id = gs.id
            AND gvp.id = $4
            AND gvp.stop_id = $5
            AND mg.place_id = $6
          RETURNING gvp.*
        `;
    const filtered = adapter._addTenantFilter(sql, userId);
    expect(filtered).toContain('FROM guide_stops gs');
    expect(filtered).toContain('AND user_id = $7');
    expect(filtered).toContain('RETURNING gvp.*');
  });

  test('guide variant DELETE uses guide_places for user_id scope', () => {
    const sql = `
          DELETE FROM guide_variant_presentations gvp
          USING guide_stops gs, guide_master_guides mg, guide_places p
          WHERE gvp.stop_id = gs.id
            AND gs.master_guide_id = mg.id
            AND mg.place_id = p.id
            AND gvp.id = $1
            AND gvp.stop_id = $2
            AND mg.place_id = $3
          RETURNING gvp.id
        `;
    const filtered = adapter._addTenantFilter(sql, userId);
    expect(filtered).toContain('guide_places p');
    expect(filtered).toContain('AND user_id = $4');
    expect(filtered).toContain('RETURNING gvp.id');
  });

  test('guide variant staleness UPDATE joins guide_places for user_id scope', () => {
    const sql = `
          UPDATE guide_variant_presentations gvp
          SET
            staleness_status = 'stale',
            updated_at = CURRENT_TIMESTAMP
          FROM guide_stops gs
          INNER JOIN guide_master_guides mg ON mg.id = gs.master_guide_id
          INNER JOIN guide_places p ON p.id = mg.place_id
          WHERE gvp.stop_id = gs.id
            AND gs.id = $1
            AND mg.place_id = $2
            AND gvp.staleness_status <> 'stale'
        `;
    const filtered = adapter._addTenantFilter(sql, userId);
    expect(filtered).toContain('FROM guide_stops gs');
    expect(filtered).toContain('AND user_id = $3');
  });

  test('guide audio GET joins guide_places for user_id scope', () => {
    const sql = `
          SELECT ga.*
          FROM guide_audio ga
          INNER JOIN guide_variant_presentations gvp ON gvp.id = ga.variant_presentation_id
          INNER JOIN guide_stops gs ON gs.id = gvp.stop_id
          INNER JOIN guide_master_guides mg ON mg.id = gs.master_guide_id
          INNER JOIN guide_places p ON p.id = mg.place_id
          WHERE ga.variant_presentation_id = $1
            AND gvp.stop_id = $2
            AND mg.place_id = $3
        `;
    const filtered = adapter._addTenantFilter(sql, userId);
    expect(filtered).toContain('INNER JOIN guide_places p');
    expect(filtered).toContain('AND user_id = $4');
  });

  test('guide audio UPDATE joins guide_places for user_id scope', () => {
    const sql = `
          UPDATE guide_audio ga
          SET
            status = $1,
            provider_key = $2,
            storage_ref = $3,
            duration_ms = $4,
            mime_type = $5,
            error_message = $6,
            updated_at = CURRENT_TIMESTAMP
          FROM guide_variant_presentations gvp
          INNER JOIN guide_stops gs ON gs.id = gvp.stop_id
          INNER JOIN guide_master_guides mg ON mg.id = gs.master_guide_id
          INNER JOIN guide_places p ON p.id = mg.place_id
          WHERE ga.variant_presentation_id = gvp.id
            AND ga.variant_presentation_id = $7
            AND gvp.stop_id = $8
            AND mg.place_id = $9
          RETURNING ga.*
        `;
    const filtered = adapter._addTenantFilter(sql, userId);
    expect(filtered).toContain('FROM guide_variant_presentations gvp');
    expect(filtered).toContain('AND user_id = $10');
    expect(filtered).toContain('RETURNING ga.*');
  });

  test('guide audio DELETE uses guide_places for user_id scope', () => {
    const sql = `
          DELETE FROM guide_audio ga
          USING guide_variant_presentations gvp, guide_stops gs, guide_master_guides mg, guide_places p
          WHERE ga.variant_presentation_id = gvp.id
            AND gvp.stop_id = gs.id
            AND gs.master_guide_id = mg.id
            AND mg.place_id = p.id
            AND ga.variant_presentation_id = $1
            AND gvp.stop_id = $2
            AND mg.place_id = $3
          RETURNING ga.id
        `;
    const filtered = adapter._addTenantFilter(sql, userId);
    expect(filtered).toContain('guide_places p');
    expect(filtered).toContain('AND user_id = $4');
    expect(filtered).toContain('RETURNING ga.id');
  });

  test('guide audio staleness UPDATE joins guide_places for user_id scope', () => {
    const sql = `
          UPDATE guide_audio ga
          SET
            status = 'stale',
            updated_at = CURRENT_TIMESTAMP
          FROM guide_variant_presentations gvp
          INNER JOIN guide_stops gs ON gs.id = gvp.stop_id
          INNER JOIN guide_master_guides mg ON mg.id = gs.master_guide_id
          INNER JOIN guide_places p ON p.id = mg.place_id
          WHERE ga.variant_presentation_id = gvp.id
            AND gs.id = $1
            AND mg.place_id = $2
            AND ga.status <> 'stale'
        `;
    const filtered = adapter._addTenantFilter(sql, userId);
    expect(filtered).toContain('FROM guide_variant_presentations gvp');
    expect(filtered).toContain('AND user_id = $3');
  });

  test('guide audio generation state UPDATE joins guide_places for user_id scope', () => {
    const sql = `
          UPDATE guide_audio ga
          SET
            status = $1,
            storage_ref = $2,
            duration_ms = $3,
            mime_type = $4,
            error_message = $5,
            updated_at = CURRENT_TIMESTAMP
          FROM guide_variant_presentations gvp
          INNER JOIN guide_stops gs ON gs.id = gvp.stop_id
          INNER JOIN guide_master_guides mg ON mg.id = gs.master_guide_id
          INNER JOIN guide_places p ON p.id = mg.place_id
          WHERE ga.variant_presentation_id = gvp.id
            AND ga.variant_presentation_id = $6
            AND gvp.stop_id = $7
            AND mg.place_id = $8
          RETURNING ga.*
        `;
    const filtered = adapter._addTenantFilter(sql, userId);
    expect(filtered).toContain('FROM guide_variant_presentations gvp');
    expect(filtered).toContain('AND user_id = $9');
    expect(filtered).toContain('RETURNING ga.*');
  });
});

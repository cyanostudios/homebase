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

  test('LIST query with multiline ORDER BY inserts WHERE before ORDER BY', () => {
    const sql = `
          SELECT
            i.id,
            i.title,
            i.sort_order
          FROM instructions i
          LEFT JOIN (
            SELECT instruction_id, COUNT(*)::int AS cnt
            FROM instruction_steps
            GROUP BY instruction_id
          ) s ON s.instruction_id = i.id
          ORDER BY
            COALESCE(NULLIF(btrim(i.category), ''), '') ASC,
            i.sort_order ASC NULLS LAST,
            lower(i.title) ASC,
            i.id ASC
        `;
    const filtered = adapter._addTenantFilter(sql, userId);
    expect(filtered).toMatch(/WHERE user_id = \$1\s+ORDER BY/);
    expect(filtered).not.toMatch(/ORDER BY[\s\S]*WHERE user_id/);
    expect(filtered).toContain('GROUP BY instruction_id');
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

  test('guide presentation LIST joins guide_places for user_id scope', () => {
    const sql = `
          SELECT gp.*
          FROM guide_presentations gp
          INNER JOIN guide_master_guides mg ON mg.id = gp.master_guide_id
          INNER JOIN guide_places p ON p.id = mg.place_id
          WHERE mg.place_id = $1
          ORDER BY gp.language ASC, gp.id ASC
        `;
    const filtered = adapter._addTenantFilter(sql, userId);
    expect(filtered).toContain('INNER JOIN guide_places p');
    expect(filtered).toContain('AND user_id = $2');
    expect(filtered).toContain('ORDER BY gp.language ASC');
  });

  test('guide presentation UPDATE joins guide_places for user_id scope', () => {
    const sql = `
          UPDATE guide_presentations gp
          SET
            presentation_text = $1,
            publication_status = $2,
            approval_status = $3,
            updated_at = CURRENT_TIMESTAMP
          FROM guide_master_guides mg
          INNER JOIN guide_places p ON p.id = mg.place_id
          WHERE gp.master_guide_id = mg.id
            AND gp.language = $4
            AND mg.place_id = $5
          RETURNING gp.*
        `;
    const filtered = adapter._addTenantFilter(sql, userId);
    expect(filtered).toContain('FROM guide_master_guides mg');
    expect(filtered).toContain('AND user_id = $6');
    expect(filtered).toContain('RETURNING gp.*');
  });

  test('guide presentation production apply UPDATE joins guide_places for user_id scope', () => {
    const sql = `
          UPDATE guide_presentations gp
          SET
            presentation_text = $1,
            approval_status = 'approved',
            updated_at = CURRENT_TIMESTAMP
          FROM guide_master_guides mg
          INNER JOIN guide_places p ON p.id = mg.place_id
          WHERE gp.master_guide_id = mg.id
            AND gp.id = $2
            AND mg.place_id = $3
          RETURNING gp.*
        `;
    const filtered = adapter._addTenantFilter(sql, userId);
    expect(filtered).toContain('FROM guide_master_guides mg');
    expect(filtered).toContain('AND user_id = $4');
    expect(filtered).toContain('RETURNING gp.*');
  });

  test('LIST query with LATERAL languages aggregate receives outer user_id filter', () => {
    const sql = `
          SELECT
            p.*,
            mg.id AS master_guide_id,
            mg.source_language,
            mg.editorial_status AS master_editorial_status,
            COALESCE(lang.languages, ARRAY[]::text[]) AS generated_languages
          FROM guide_places p
          INNER JOIN guide_master_guides mg ON mg.place_id = p.id
          LEFT JOIN LATERAL (
            SELECT ARRAY_AGG(gp.language ORDER BY gp.language) AS languages
            FROM guide_presentations gp
            WHERE gp.master_guide_id = mg.id
              AND NULLIF(TRIM(gp.presentation_text), '') IS NOT NULL
          ) lang ON true
          ORDER BY p.updated_at DESC, p.id DESC
        `;
    const filtered = adapter._addTenantFilter(sql, userId);
    expect(filtered).toContain('lang ON true');
    expect(filtered).toContain('WHERE user_id = $1');
    expect(filtered).toContain('ORDER BY p.updated_at DESC');
    // Must not inject into ARRAY_AGG(... ORDER BY ...) or LATERAL WHERE
    expect(filtered).toContain('ARRAY_AGG(gp.language ORDER BY gp.language)');
    expect(filtered).toMatch(/lang ON true\s+WHERE user_id = \$1\s+ORDER BY/);
    expect(filtered).not.toMatch(/ARRAY_AGG\(gp\.language AND user_id/);
    expect(filtered).not.toMatch(/lang ON true AND user_id/);
  });

  test('GET by id with LATERAL languages aggregate receives outer user_id filter', () => {
    const sql = `
          SELECT
            p.*,
            mg.id AS master_guide_id,
            mg.source_language,
            mg.editorial_status AS master_editorial_status,
            COALESCE(lang.languages, ARRAY[]::text[]) AS generated_languages
          FROM guide_places p
          INNER JOIN guide_master_guides mg ON mg.place_id = p.id
          LEFT JOIN LATERAL (
            SELECT ARRAY_AGG(gp.language ORDER BY gp.language) AS languages
            FROM guide_presentations gp
            WHERE gp.master_guide_id = mg.id
              AND NULLIF(TRIM(gp.presentation_text), '') IS NOT NULL
          ) lang ON true
          WHERE p.id = $1
        `;
    const filtered = adapter._addTenantFilter(sql, userId);
    expect(filtered).toContain('WHERE p.id = $1');
    expect(filtered).toContain('AND user_id = $2');
    expect(filtered).toContain('ARRAY_AGG(gp.language ORDER BY gp.language)');
    expect(filtered).not.toMatch(/ARRAY_AGG\(gp\.language AND user_id/);
  });
});

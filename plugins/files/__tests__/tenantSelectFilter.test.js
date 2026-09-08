// plugins/files/__tests__/tenantSelectFilter.test.js
const PostgreSQLAdapter = require('../../../server/core/services/database/adapters/PostgreSQLAdapter');

describe('files tenant filter compatibility', () => {
  const adapter = new PostgreSQLAdapter(null, null);
  const userId = 42;

  test('getAll SELECT without user_id receives tenant filter', () => {
    const sql = `SELECT id, name, size, mime_type, url, storage_provider, external_file_id, created_at, updated_at
         FROM user_files
         ORDER BY updated_at DESC, id DESC`;
    const filtered = adapter._addTenantFilter(sql, userId);
    expect(filtered).toMatch(/WHERE user_id = \$1/);
    expect(filtered).toContain('ORDER BY updated_at DESC');
  });

  test('getById SELECT without user_id receives AND tenant filter', () => {
    const sql = `SELECT id, name, size, mime_type, url, storage_provider, external_file_id, created_at, updated_at
         FROM user_files
         WHERE id = $1
         LIMIT 1`;
    const filtered = adapter._addTenantFilter(sql, userId);
    expect(filtered).toContain('WHERE id = $1');
    expect(filtered).toContain('AND user_id = $2');
  });

  test('legacy SELECT listing user_id skips tenant filter (regression guard)', () => {
    const sql = `SELECT id, user_id, name FROM user_files ORDER BY id DESC`;
    const filtered = adapter._addTenantFilter(sql, userId);
    expect(filtered).toBe(sql);
    expect(filtered).not.toMatch(/WHERE user_id = \$/);
  });

  test('attachment list JOIN with qualified user_id skips auto-filter (no ambiguous column)', () => {
    // Production SQL from AttachmentModel.listForEntity — both tables have user_id.
    const sql = `
        SELECT fa.id AS attachment_id, fa.created_at AS attached_at,
               f.id, f.name, f.size, f.mime_type, f.url,
               f.storage_provider, f.external_file_id, f.created_at, f.updated_at
        FROM file_attachments fa
        INNER JOIN user_files f ON f.id = fa.file_id AND f.user_id = $3
        WHERE fa.plugin_name = $1 AND fa.entity_id = $2 AND fa.user_id = $3
        ORDER BY fa.created_at DESC
      `;
    const filtered = adapter._addTenantFilter(sql, userId);
    expect(filtered).toBe(sql);
    expect(filtered).not.toMatch(/AND user_id = \$/);
    expect(filtered).toContain('fa.user_id = $3');
    expect(filtered).toContain('f.user_id = $3');
  });

  test('JOIN without qualified user_id would get ambiguous bare filter (anti-pattern guard)', () => {
    const sql = `
        SELECT fa.id AS attachment_id, f.id, f.name
        FROM file_attachments fa
        INNER JOIN user_files f ON f.id = fa.file_id
        WHERE fa.plugin_name = $1 AND fa.entity_id = $2
        ORDER BY fa.created_at DESC
      `;
    const filtered = adapter._addTenantFilter(sql, userId);
    // Bare user_id is ambiguous across fa|f — must not ship this pattern
    expect(filtered).toMatch(/AND user_id = \$3/);
    expect(filtered).not.toMatch(/\bfa\.user_id\b/);
  });
});

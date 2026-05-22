// server/core/utils/tenantMainDb.js
// Helpers for inserting tenant rows on main DB across legacy/modern schemas.

async function hasTableColumn(db, tableName, columnName) {
  const rows = await db.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [tableName, columnName],
  );
  const list = rows?.rows ?? (Array.isArray(rows) ? rows : []);
  return list.length > 0;
}

async function hasTable(db, tableName) {
  const rows = await db.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1`,
    [tableName],
  );
  const list = rows?.rows ?? (Array.isArray(rows) ? rows : []);
  return list.length > 0;
}

function firstRow(result) {
  const rows = result?.rows ?? (Array.isArray(result) ? result : []);
  return rows[0];
}

/**
 * Insert or update tenants row for a user (Neon signup / repair).
 * @returns {Promise<number>} tenant id
 */
async function upsertTenantRecord(db, { userId, projectId, databaseName, connectionString }) {
  const hasOwner = await hasTableColumn(db, 'tenants', 'owner_user_id');

  const existing = await db.query('SELECT id FROM tenants WHERE user_id = $1 LIMIT 1', [userId]);
  const existingId = firstRow(existing)?.id;

  if (existingId) {
    if (hasOwner) {
      await db.query(
        `UPDATE tenants SET
           neon_project_id = $2,
           neon_database_name = $3,
           neon_connection_string = $4,
           owner_user_id = COALESCE(owner_user_id, $1),
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $5`,
        [userId, projectId, databaseName, connectionString, existingId],
      );
    } else {
      await db.query(
        `UPDATE tenants SET
           neon_project_id = $2,
           neon_database_name = $3,
           neon_connection_string = $4,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $5`,
        [userId, projectId, databaseName, connectionString, existingId],
      );
    }
    return existingId;
  }

  let inserted;
  if (hasOwner) {
    inserted = await db.query(
      `INSERT INTO tenants (user_id, owner_user_id, neon_project_id, neon_database_name, neon_connection_string)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [userId, userId, projectId, databaseName, connectionString],
    );
  } else {
    inserted = await db.query(
      `INSERT INTO tenants (user_id, neon_project_id, neon_database_name, neon_connection_string)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [userId, projectId, databaseName, connectionString],
    );
  }

  const id = firstRow(inserted)?.id;
  if (!id) throw new Error('Failed to create tenant row');
  return id;
}

async function ensureTenantMembership(db, tenantId, userId) {
  if (!(await hasTable(db, 'tenant_memberships'))) return;
  await db.query(
    `INSERT INTO tenant_memberships (tenant_id, user_id, role, status, created_by)
     VALUES ($1, $2, 'admin', 'active', $3)
     ON CONFLICT (user_id) DO NOTHING`,
    [tenantId, userId, userId],
  );
}

module.exports = {
  hasTableColumn,
  hasTable,
  upsertTenantRecord,
  ensureTenantMembership,
  firstRow,
};

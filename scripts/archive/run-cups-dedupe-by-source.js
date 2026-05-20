#!/usr/bin/env node

const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const sourcePattern =
  (process.argv.find((a) => a.startsWith('--source-pattern=')) || '')
    .replace('--source-pattern=', '')
    .trim() || 'smaland';
const apply = process.argv.includes('--apply');

function scoreCup(row) {
  let score = 0;
  if (row.deleted_at == null) score += 100;
  if (row.external_id) score += 30;
  if (row.start_date) score += 25;
  if (row.end_date) score += 10;
  if (row.organizer) score += 8;
  if (row.location) score += 5;
  if (row.registration_url) score += 5;
  if (row.categories) score += 3;
  if (row.team_count != null) score += 2;
  return score;
}

function pickKeeper(rows) {
  const sorted = [...rows].sort((a, b) => {
    const scoreDiff = scoreCup(b) - scoreCup(a);
    if (scoreDiff !== 0) return scoreDiff;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
  return sorted[0];
}

function mergeKeeper(keeper, rows) {
  const merged = { ...keeper };
  const byScore = [...rows].sort((a, b) => scoreCup(b) - scoreCup(a));
  const fields = [
    'organizer',
    'location',
    'start_date',
    'end_date',
    'categories',
    'team_count',
    'match_format',
    'description',
    'registration_url',
    'external_id',
  ];
  for (const field of fields) {
    if (merged[field] != null && String(merged[field]).trim() !== '') continue;
    for (const row of byScore) {
      if (row[field] != null && String(row[field]).trim() !== '') {
        merged[field] = row[field];
        break;
      }
    }
  }
  return merged;
}

async function tenantConnections(mainPool) {
  const tenantProvider = process.env.TENANT_PROVIDER || 'neon';
  if (tenantProvider === 'local') {
    const users = await mainPool.query('SELECT id as user_id, email FROM users ORDER BY id');
    return users.rows.map((u) => ({
      user_id: u.user_id,
      email: u.email,
      connection_string: `${process.env.DATABASE_URL}?options=-csearch_path%3Dtenant_${u.user_id}`,
      schema_name: `tenant_${u.user_id}`,
    }));
  }

  const result = await mainPool.query(`
    SELECT t.user_id, t.neon_connection_string as connection_string, u.email
    FROM tenants t
    INNER JOIN users u ON t.user_id = u.id
    WHERE t.neon_connection_string IS NOT NULL
    ORDER BY t.user_id
  `);
  return result.rows;
}

async function runForTenant(tenant) {
  const pool = new Pool({
    connectionString: tenant.connection_string || tenant.neon_connection_string,
  });
  const client = await pool.connect();
  const summary = { scannedGroups: 0, dedupedGroups: 0, removedRows: 0, keptRows: 0, samples: [] };

  try {
    if (tenant.schema_name) {
      await client.query(`SET search_path TO ${tenant.schema_name}`);
    }

    const dupes = await client.query(
      `WITH source_ids AS (
         SELECT id
         FROM ingest_sources
         WHERE lower(source_url) LIKE $1
       )
       SELECT c.ingest_source_id,
              lower(trim(c.name)) as name_key,
              array_agg(c.id ORDER BY c.updated_at DESC) as ids,
              count(*)::int as cnt
       FROM cups c
       WHERE c.ingest_source_id IN (SELECT id FROM source_ids)
         AND c.name IS NOT NULL
         AND trim(c.name) <> ''
       GROUP BY c.ingest_source_id, lower(trim(c.name))
       HAVING count(*) > 1
       ORDER BY cnt DESC, name_key ASC`,
      [`%${sourcePattern.toLowerCase()}%`],
    );

    summary.scannedGroups = dupes.rows.length;

    for (const group of dupes.rows) {
      const rowsRes = await client.query(
        `SELECT *
         FROM cups
         WHERE id = ANY($1::int[])
         ORDER BY updated_at DESC`,
        [group.ids],
      );
      const rows = rowsRes.rows;
      if (rows.length < 2) continue;

      const keeper = pickKeeper(rows);
      const merged = mergeKeeper(keeper, rows);
      const removeIds = rows.filter((r) => r.id !== keeper.id).map((r) => r.id);

      summary.dedupedGroups += 1;
      summary.keptRows += 1;
      summary.removedRows += removeIds.length;
      if (summary.samples.length < 8) {
        summary.samples.push({
          ingest_source_id: group.ingest_source_id,
          name_key: group.name_key,
          kept_id: keeper.id,
          removed_ids: removeIds,
        });
      }

      if (apply) {
        await client.query(
          `UPDATE cups
             SET organizer = $2,
                 location = $3,
                 start_date = $4,
                 end_date = $5,
                 categories = $6,
                 team_count = $7,
                 match_format = $8,
                 description = $9,
                 registration_url = $10,
                 external_id = $11,
                 deleted_at = NULL,
                 updated_at = NOW()
           WHERE id = $1`,
          [
            keeper.id,
            merged.organizer,
            merged.location,
            merged.start_date,
            merged.end_date,
            merged.categories,
            merged.team_count,
            merged.match_format,
            merged.description,
            merged.registration_url,
            merged.external_id,
          ],
        );

        await client.query('DELETE FROM cups WHERE id = ANY($1::int[])', [removeIds]);
      }
    }

    return summary;
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  const mainPool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const tenants = await tenantConnections(mainPool);
    console.log(`[cups-dedupe] mode=${apply ? 'APPLY' : 'DRY-RUN'} sourcePattern=${sourcePattern}`);
    console.log(`[cups-dedupe] tenants=${tenants.length}`);

    let totalGroups = 0;
    let totalDeduped = 0;
    let totalRemoved = 0;

    for (const tenant of tenants) {
      const summary = await runForTenant(tenant);
      totalGroups += summary.scannedGroups;
      totalDeduped += summary.dedupedGroups;
      totalRemoved += summary.removedRows;
      if (summary.scannedGroups > 0) {
        console.log(`\n[tenant] ${tenant.email} (user_id=${tenant.user_id})`);
        console.log(
          `  groups=${summary.scannedGroups} deduped=${summary.dedupedGroups} removed=${summary.removedRows}`,
        );
        for (const s of summary.samples) {
          console.log(
            `   - source=${s.ingest_source_id} name='${s.name_key}' keep=${s.kept_id} drop=${s.removed_ids.join(',')}`,
          );
        }
      }
    }

    console.log(
      `\n[cups-dedupe] done groups=${totalGroups} deduped=${totalDeduped} removed=${totalRemoved}`,
    );
  } finally {
    await mainPool.end();
  }
}

main().catch((error) => {
  console.error('[cups-dedupe] failed:', error.message);
  process.exit(1);
});

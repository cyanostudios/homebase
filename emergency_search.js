// Search for ANY table that has "delivered" orders
const { Pool } = require('pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_G1SYpf4nvmtl@ep-steep-snow-agp0p6ln-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

async function searchEverywhere() {
    const pool = new Pool({ connectionString: DATABASE_URL });

    try {
        console.log('\n=== EMERGENCY DATA SEARCH ===\n');

        // Find every table that has a column named 'status'
        const tables = await pool.query(`
      SELECT table_schema, table_name 
      FROM information_schema.columns 
      WHERE column_name = 'status'
      AND table_schema NOT IN ('information_schema', 'pg_catalog')
    `);

        console.log('Tables with a "status" column:');
        console.table(tables.rows);

        for (const t of tables.rows) {
            const s = t.table_schema;
            const n = t.table_name;

            try {
                const result = await pool.query(`SELECT status, COUNT(*) as count FROM "${s}"."${n}" GROUP BY status`);
                if (result.rows.length > 0) {
                    console.log(`\n--- ${s}.${n} ---`);
                    console.table(result.rows);
                }
            } catch (e) { }
        }

        // Check for audit logs / activity
        const activityCols = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'activity_log'
    `);

        if (activityCols.rows.length > 0) {
            const hasAction = activityCols.rows.some(r => r.column_name === 'action');
            const hasTable = activityCols.rows.some(r => r.column_name === 'table_name');

            if (hasAction && hasTable) {
                console.log('\n=== RECENT ACTIVITY LOG ===');
                const logs = await pool.query(`
          SELECT action, table_name, record_id, created_at 
          FROM activity_log 
          ORDER BY created_at DESC 
          LIMIT 20
        `);
                console.table(logs.rows);
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

searchEverywhere();

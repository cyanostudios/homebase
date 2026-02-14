// List ALL tables in ALL schemas
const { Pool } = require('pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_G1SYpf4nvmtl@ep-steep-snow-agp0p6ln-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

async function listAllTables() {
    const pool = new Pool({ connectionString: DATABASE_URL });

    try {
        console.log('\n=== GLOBAL TABLE SCAN ===\n');

        const tables = await pool.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
      ORDER BY table_schema, table_name
    `);

        console.table(tables.rows);

        // Also check for 'order_number_counter' content
        for (const schema of ['public', 'tenant_1']) {
            try {
                const counter = await pool.query(`SELECT * FROM "${schema}".order_number_counter`);
                console.log(`\n--- Counter in ${schema} ---`);
                console.table(counter.rows);
            } catch (e) { }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

listAllTables();

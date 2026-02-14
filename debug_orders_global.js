// Find 'orders' table in ANY schema
const { Pool } = require('pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_G1SYpf4nvmtl@ep-steep-snow-agp0p6ln-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

async function findOrdersEverywhere() {
    const pool = new Pool({ connectionString: DATABASE_URL });

    try {
        console.log('\n=== GLOBAL SEARCH FOR ORDERS ===\n');

        // Find all tables named 'orders' across all schemas
        const tables = await pool.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_name = 'orders'
      ORDER BY table_schema
    `);

        console.log('Found "orders" tables in these schemas:');
        console.table(tables.rows);

        for (const t of tables.rows) {
            const s = t.table_schema;
            console.log(`\n--- Schema: ${s} ---`);

            const counts = await pool.query(`
        SELECT status, COUNT(*) as count
        FROM "${s}".orders
        GROUP BY status
      `);
            console.table(counts.rows);
        }

        console.log('\n=== CHECKING IF DATA WAS RECENTLY DELETED ===');
        // Check for audit logs if any exist (activity_log)
        const logsExist = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'activity_log'
      )
    `);

        if (logsExist.rows[0].exists) {
            // Search for DELETE operations on orders table today
            const deletions = await pool.query(`
         SELECT action, table_name, record_id, created_at, user_id
         FROM activity_log
         WHERE table_name = 'orders' AND action = 'DELETE'
         ORDER BY created_at DESC
         LIMIT 10
       `);
            console.log('Recent deletions on orders table:');
            console.table(deletions.rows);
        } else {
            console.log('No activity_log table found.');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

findOrdersEverywhere();

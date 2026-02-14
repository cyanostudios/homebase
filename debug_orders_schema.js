// Comprehensive debug script to find missing orders
const { Pool } = require('pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_G1SYpf4nvmtl@ep-steep-snow-agp0p6ln-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

async function findOrders() {
    const pool = new Pool({ connectionString: DATABASE_URL });

    try {
        console.log('\n=== SCHEMA CHECK ===\n');

        // Check what schemas exist
        const schemas = await pool.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name LIKE 'tenant_%' OR schema_name = 'public'
    `);
        console.log('Available schemas:');
        console.table(schemas.rows);

        for (const schema of schemas.rows) {
            const s = schema.schema_name;
            console.log(`\n--- Checking schema: ${s} ---`);

            try {
                // Check if orders table exists in this schema
                const tableExists = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = $1 AND table_name = 'orders'
          )
        `, [s]);

                if (!tableExists.rows[0].exists) {
                    console.log(`Table 'orders' does not exist in ${s}`);
                    continue;
                }

                // Count orders by status and user_id in this schema
                const counts = await pool.query(`
          SELECT status, user_id, COUNT(*) as count
          FROM ${s}.orders
          GROUP BY status, user_id
          ORDER BY user_id, status
        `);
                console.table(counts.rows);

                if (counts.rows.length > 0) {
                    // Show a few samples
                    const samples = await pool.query(`
            SELECT id, user_id, status, channel_order_id, created_at
            FROM ${s}.orders
            ORDER BY created_at DESC
            LIMIT 3
          `);
                    console.log('Sample rows:');
                    console.table(samples.rows);
                }
            } catch (e) {
                console.error(`Error checking schema ${s}:`, e.message);
            }
        }

    } catch (error) {
        console.error('Core Error:', error);
    } finally {
        await pool.end();
    }
}

findOrders();

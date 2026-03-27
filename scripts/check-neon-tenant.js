// scripts/check-neon-tenant.js
// Check if there's a Neon tenant and what connection string it uses

const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function checkNeonTenant() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const result = await pool.query(`
      SELECT 
        t.owner_user_id,
        u.email,
        t.neon_connection_string,
        t.neon_database_name,
        t.neon_project_id
      FROM public.tenants t
      INNER JOIN public.users u ON t.owner_user_id = u.id
      ORDER BY t.owner_user_id
    `);

    if (result.rows.length === 0) {
      console.log('⚠️  No Neon tenants found in database');
      console.log('💡 This means you are using LocalTenantProvider (schema-per-tenant)');
    } else {
      console.log(`Found ${result.rows.length} Neon tenant(s):\n`);
      result.rows.forEach((row) => {
        console.log(`Tenant owner ${row.owner_user_id} (${row.email}):`);
        console.log(
          `  Connection: ${row.neon_connection_string ? '✅ Has connection string' : '❌ No connection string'}`,
        );
        console.log(`  Database: ${row.neon_database_name || 'N/A'}`);
        console.log(`  Project: ${row.neon_project_id || 'N/A'}`);
        if (row.neon_connection_string) {
          const masked = row.neon_connection_string.replace(/:[^:@]+@/, ':****@');
          console.log(`  Connection String: ${masked}`);
        }
        console.log('');
      });
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkNeonTenant();

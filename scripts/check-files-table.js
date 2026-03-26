// scripts/check-files-table.js
// Check if user_files table exists in tenant schemas

const { Pool } = require('pg');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function checkFilesTable() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const mainPool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    // Get all users
    const usersResult = await mainPool.query(`
      SELECT id, email
      FROM public.users
      ORDER BY id
    `);

    console.log(`Found ${usersResult.rows.length} user(s)\n`);

    for (const user of usersResult.rows) {
      const schemaName = `tenant_${user.id}`;
      console.log(`Checking schema: ${schemaName} (${user.email})...`);

      // Check if schema exists
      const schemaCheck = await mainPool.query(
        `SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1`,
        [schemaName],
      );

      if (schemaCheck.rows.length === 0) {
        console.log(`   ⚠️  Schema ${schemaName} does not exist\n`);
        continue;
      }

      // Set search_path and check for table
      const client = await mainPool.connect();
      try {
        await client.query('BEGIN');
        try {
          await client.query(`SET LOCAL search_path TO ${schemaName}`);

          const tableCheck = await client.query(
            `
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = $1 AND table_name = 'user_files'
        `,
            [schemaName],
          );

          if (tableCheck.rows.length > 0) {
            console.log(`   ✅ Table user_files exists in ${schemaName}`);

            // Check row count
            const countResult = await client.query(`SELECT COUNT(*) as count FROM user_files`);
            console.log(`   📊 Row count: ${countResult.rows[0].count}`);
          } else {
            console.log(`   ❌ Table user_files does NOT exist in ${schemaName}`);
            console.log(`   💡 Run: npm run migrate:files`);
          }
          await client.query('COMMIT');
        } catch (inner) {
          try {
            await client.query('ROLLBACK');
          } catch {}
          throw inner;
        }
      } finally {
        client.release();
      }
      console.log('');
    }
  } catch (error) {
    console.error('❌ Error checking tables:', error);
    process.exit(1);
  } finally {
    await mainPool.end();
  }
}

checkFilesTable();

// scripts/debug-login.js
// Debug script to check users and tenant databases

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function debugLogin() {
  const client = await pool.connect();

  try {
    console.log('🔍 Debugging login issues...\n');
    console.log(
      '📍 Database:',
      process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@') || 'NOT SET',
    );
    console.log('\n');

    // Check all users
    console.log('👥 All users in database:');
    const usersResult = await client.query(
      'SELECT id, email, role, created_at FROM users ORDER BY id',
    );

    if (usersResult.rows.length === 0) {
      console.log('  ❌ No users found in database!');
      console.log('  💡 Run: node scripts/setup-database.js to create default admin user');
    } else {
      for (const user of usersResult.rows) {
        console.log(`  - ID: ${user.id}, Email: ${user.email}, Role: ${user.role}`);
      }
    }
    console.log('\n');

    // Check specific user
    const testEmail = 'admin@homebase.se';
    console.log(`🔍 Checking user: ${testEmail}`);
    const userResult = await client.query('SELECT * FROM users WHERE email = $1', [testEmail]);

    if (userResult.rows.length === 0) {
      console.log(`  ❌ User ${testEmail} not found!`);
    } else {
      const user = userResult.rows[0];
      console.log(`  ✅ User found:`);
      console.log(`     ID: ${user.id}`);
      console.log(`     Email: ${user.email}`);
      console.log(`     Role: ${user.role}`);
      console.log(`     Has password_hash: ${!!user.password_hash}`);
      console.log(`     Password hash length: ${user.password_hash?.length || 0}`);

      // Test password
      const testPassword = 'admin123';
      const isValid = await bcrypt.compare(testPassword, user.password_hash);
      console.log(`     Password '${testPassword}' valid: ${isValid ? '✅ YES' : '❌ NO'}`);
      console.log('\n');

      // Check tenant database
      console.log(`  🗄️  Checking tenant database for user ${user.id}:`);
      const tenantResult = await client.query('SELECT * FROM tenants WHERE user_id = $1', [
        user.id,
      ]);

      if (tenantResult.rows.length === 0) {
        console.log(`     ❌ No tenant database configured!`);
        console.log(`     💡 This will cause login to fail with "Tenant database not configured"`);
      } else {
        const tenant = tenantResult.rows[0];
        console.log(`     ✅ Tenant database found:`);
        console.log(`        Project ID: ${tenant.neon_project_id || 'N/A'}`);
        console.log(`        Database Name: ${tenant.neon_database_name || 'N/A'}`);
        console.log(`        Has connection string: ${!!tenant.neon_connection_string}`);
      }
      console.log('\n');

      // Check plugin access
      console.log(`  🔌 Checking plugin access for user ${user.id}:`);
      const pluginsResult = await client.query(
        'SELECT plugin_name, enabled FROM user_plugin_access WHERE user_id = $1',
        [user.id],
      );

      if (pluginsResult.rows.length === 0) {
        console.log(`     ⚠️  No plugin access configured`);
      } else {
        console.log(`     Plugins:`);
        for (const plugin of pluginsResult.rows) {
          console.log(
            `       - ${plugin.plugin_name}: ${plugin.enabled ? '✅ enabled' : '❌ disabled'}`,
          );
        }
      }
    }
    console.log('\n');

    // Summary
    console.log('📋 Summary:');
    console.log('  1. Check if user exists in database');
    console.log('  2. Check if password hash is valid');
    console.log('  3. Check if tenant database is configured');
    console.log('  4. Check server logs for detailed error messages');
    console.log('\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

debugLogin()
  .then(() => {
    console.log('✅ Debug completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Debug failed:', error);
    process.exit(1);
  });

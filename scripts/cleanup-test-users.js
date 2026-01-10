#!/usr/bin/env node
// scripts/cleanup-test-users.js
// Safe script to cleanup test users while preserving superuser
// Run with: node scripts/cleanup-test-users.js --confirm

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function cleanup() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Finding superuser...\n');
    
    // Get superuser ID dynamically (never hardcode!)
    const superuserResult = await client.query(
      "SELECT id, email FROM users WHERE role = 'superuser' ORDER BY id LIMIT 1"
    );
    
    if (superuserResult.rows.length === 0) {
      console.log('❌ No superuser found in database');
      return;
    }
    
    const superuser = superuserResult.rows[0];
    console.log(`🛡️  Superuser: ${superuser.email} (ID: ${superuser.id})`);
    console.log('   This user will be PRESERVED\n');
    
    // Count what will be deleted
    const countUsers = await client.query(
      'SELECT COUNT(*) FROM users WHERE id != $1',
      [superuser.id]
    );
    const countTenants = await client.query(
      'SELECT COUNT(*) FROM tenants WHERE user_id != $1',
      [superuser.id]
    );
    const countPlugins = await client.query(
      'SELECT COUNT(*) FROM user_plugin_access WHERE user_id != $1',
      [superuser.id]
    );
    
    const counts = {
      users: parseInt(countUsers.rows[0].count),
      tenants: parseInt(countTenants.rows[0].count),
      plugins: parseInt(countPlugins.rows[0].count),
    };
    
    console.log('📊 Items to be deleted:');
    console.log(`   Users: ${counts.users}`);
    console.log(`   Tenants: ${counts.tenants}`);
    console.log(`   Plugin access: ${counts.plugins}\n`);
    
    if (counts.users === 0 && counts.tenants === 0 && counts.plugins === 0) {
      console.log('✅ Nothing to clean up!');
      return;
    }
    
    // Check for --confirm flag
    if (!process.argv.includes('--confirm')) {
      console.log('⚠️  DRY RUN - No changes made');
      console.log('\n   To actually delete these items, run:');
      console.log('   node scripts/cleanup-test-users.js --confirm\n');
      return;
    }
    
    console.log('🗑️  Starting cleanup...\n');
    
    // Delete in correct order (foreign key constraints)
    await client.query(
      'DELETE FROM user_plugin_access WHERE user_id != $1',
      [superuser.id]
    );
    console.log(`   ✅ Deleted ${counts.plugins} plugin access entries`);
    
    await client.query(
      'DELETE FROM tenants WHERE user_id != $1',
      [superuser.id]
    );
    console.log(`   ✅ Deleted ${counts.tenants} tenant entries`);
    
    const deletedUsers = await client.query(
      'DELETE FROM users WHERE id != $1 RETURNING email',
      [superuser.id]
    );
    console.log(`   ✅ Deleted ${deletedUsers.rowCount} users`);
    
    if (deletedUsers.rows.length > 0) {
      console.log('\n📋 Deleted users:');
      deletedUsers.rows.forEach((user, i) => {
        console.log(`   ${i + 1}. ${user.email}`);
      });
    }
    
    console.log('\n✅ Cleanup complete!\n');
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the script
cleanup()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

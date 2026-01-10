// scripts/cleanup-orphaned-tenants.js
// Removes tenant entries from database where Neon project no longer exists

const { Pool } = require('pg');
const dotenv = require('dotenv');
const axios = require('axios');

// Load environment variables
dotenv.config({ path: '.env.local' });

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

class NeonService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://console.neon.tech/api/v2';
  }

  async listProjects() {
    try {
      const response = await axios.get(`${this.baseUrl}/projects`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });
      return response.data.projects || [];
    } catch (error) {
      console.error('Failed to list projects:', error.response?.data || error.message);
      throw error;
    }
  }
}

async function cleanupOrphanedTenants() {
  const client = await pool.connect();

  try {
    if (!process.env.NEON_API_KEY) {
      console.log('❌ NEON_API_KEY not set in .env.local');
      return;
    }

    console.log('🔍 Checking for orphaned tenants...\n');

    // Get all tenants from database
    const tenantsResult = await client.query('SELECT id, user_id, neon_project_id, neon_database_name, neon_connection_string FROM tenants');
    const tenants = tenantsResult.rows;

    if (tenants.length === 0) {
      console.log('✅ No tenants found in database.');
      return;
    }

    console.log(`📊 Found ${tenants.length} tenant(s) in database\n`);

    // Get all Neon projects
    const neonService = new NeonService(process.env.NEON_API_KEY);
    const projects = await neonService.listProjects();
    const projectIds = new Set(projects.map(p => p.id));

    console.log(`📦 Found ${projects.length} Neon project(s)\n`);
    console.log('='.repeat(100));

    // Find orphaned tenants (tenants where neon_project_id doesn't exist in Neon)
    const orphanedTenants = tenants.filter(tenant => {
      if (!tenant.neon_project_id) {
        return true; // Tenant without project ID is orphaned
      }
      return !projectIds.has(tenant.neon_project_id);
    });

    if (orphanedTenants.length === 0) {
      console.log('✅ No orphaned tenants found. All tenants have valid Neon projects.');
      return;
    }

    console.log(`⚠️  Found ${orphanedTenants.length} orphaned tenant(s):\n`);

    for (const tenant of orphanedTenants) {
      // Get user info
      const userResult = await client.query('SELECT id, email, role FROM users WHERE id = $1', [tenant.user_id]);
      const user = userResult.rows[0];

      if (user) {
        console.log(`   - Tenant ID: ${tenant.id}`);
        console.log(`     User ID: ${tenant.user_id}`);
        console.log(`     Email: ${user.email}`);
        console.log(`     Role: ${user.role}`);
        console.log(`     Neon Project ID: ${tenant.neon_project_id || 'N/A'}`);
        console.log(`     Database: ${tenant.neon_database_name || 'N/A'}`);
        console.log('');
      } else {
        console.log(`   - Tenant ID: ${tenant.id}`);
        console.log(`     User ID: ${tenant.user_id} (User not found in database)`);
        console.log(`     Neon Project ID: ${tenant.neon_project_id || 'N/A'}`);
        console.log('');
      }
    }

    console.log('='.repeat(100));
    console.log(`\n⚠️  This will DELETE ${orphanedTenants.length} tenant entry(ies) from the database.`);
    console.log('   The users will NOT be deleted, only the tenant mapping.');
    console.log('\n   To proceed, run this script with --confirm flag:\n');
    console.log('   node scripts/cleanup-orphaned-tenants.js --confirm\n');

    // Check if --confirm flag is provided
    if (process.argv.includes('--confirm')) {
      console.log('🗑️  Deleting orphaned tenants...\n');

      for (const tenant of orphanedTenants) {
        await client.query('DELETE FROM tenants WHERE id = $1', [tenant.id]);
        
        const userResult = await client.query('SELECT email FROM users WHERE id = $1', [tenant.user_id]);
        const user = userResult.rows[0];
        
        console.log(`   ✅ Deleted tenant entry for user ${tenant.user_id} (${user?.email || 'N/A'})`);
      }

      console.log(`\n✅ Cleanup complete! Deleted ${orphanedTenants.length} orphaned tenant entry(ies).`);
    } else {
      console.log('💡 Tip: You can also delete a specific tenant manually with SQL:');
      console.log('   DELETE FROM tenants WHERE user_id = <USER_ID>;\n');
    }

  } catch (error) {
    console.error('❌ Failed to cleanup orphaned tenants:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the script
cleanupOrphanedTenants()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

// scripts/link-neon-tenants-simple.js
// Simple script to link Neon projects to users (connection strings need to be added manually)

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const axios = require('axios');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function linkNeonTenantsSimple() {
  const client = await pool.connect();
  
  try {
    if (!process.env.NEON_API_KEY) {
      console.log('❌ NEON_API_KEY not set in .env.local');
      return;
    }

    console.log('🔍 Finding unlinked Neon projects...\n');
    
    // Get Neon projects
    const response = await axios.get(
      'https://console.neon.tech/api/v2/projects',
      {
        headers: {
          'Authorization': `Bearer ${process.env.NEON_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    const projects = response.data.projects || [];

    // Get all users and tenants from database
    const users = await client.query('SELECT id, email, role FROM users ORDER BY id');
    const tenants = await client.query('SELECT user_id, neon_project_id, neon_connection_string FROM tenants');

    const tenantMap = new Map();
    tenants.rows.forEach(t => {
      tenantMap.set(t.neon_project_id, t);
    });

    const userMap = new Map();
    users.rows.forEach(u => {
      userMap.set(u.id, u);
    });

    // Find unlinked projects
    const unlinkedProjects = projects.filter(p => !tenantMap.has(p.id));
    
    if (unlinkedProjects.length === 0) {
      console.log('✅ All Neon projects are already linked!');
      return;
    }

    console.log(`📊 Found ${unlinkedProjects.length} unlinked project(s):\n`);

    let linkedCount = 0;
    const needsConnectionString = [];

    for (const project of unlinkedProjects) {
      const projectId = project.id;
      const projectName = project.name;
      
      // Try to extract user ID from project name
      const nameMatch = projectName.match(/homebase-tenant-(\d+)/);
      if (!nameMatch) {
        console.log(`⚠️  Skipping ${projectName} - cannot extract user ID from name`);
        continue;
      }

      const userId = parseInt(nameMatch[1]);
      const user = userMap.get(userId);

      if (!user) {
        console.log(`⚠️  Skipping ${projectName} - User ID ${userId} not found in database`);
        continue;
      }

      // Check if user already has a tenant entry
      const existingTenant = await client.query(
        'SELECT * FROM tenants WHERE user_id = $1',
        [userId]
      );

      // Get connection string from existing tenant if available, otherwise use placeholder
      let connectionString = null;
      if (existingTenant.rows.length > 0 && existingTenant.rows[0].neon_connection_string) {
        connectionString = existingTenant.rows[0].neon_connection_string;
      }

      if (existingTenant.rows.length > 0) {
        // Update existing tenant with new project ID
        await client.query(
          `UPDATE tenants 
           SET neon_project_id = $1, 
               neon_database_name = $2,
               updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $3`,
          [projectId, 'neondb', userId]
        );
        
        console.log(`✅ Updated tenant for user ${user.email} (ID: ${userId})`);
        console.log(`   Project: ${projectName} (${projectId})`);
        if (!connectionString) {
          console.log(`   ⚠️  Connection string missing - needs to be added manually`);
          needsConnectionString.push({ user: user.email, userId, projectId, projectName });
        }
        linkedCount++;
      } else {
        // For new entries, we need a connection string
        // Since we can't get it from API, we'll create entry but mark it as needing update
        const placeholderConnection = `postgresql://needs-update@neon.tech/neondb?sslmode=require`;
        
        await client.query(
          `INSERT INTO tenants (user_id, neon_project_id, neon_database_name, neon_connection_string)
           VALUES ($1, $2, $3, $4)`,
          [userId, projectId, 'neondb', placeholderConnection]
        );

        console.log(`✅ Linked ${projectName} to user ${user.email} (ID: ${userId})`);
        console.log(`   ⚠️  Connection string is placeholder - needs to be updated from Neon Console`);
        needsConnectionString.push({ user: user.email, userId, projectId, projectName });
        linkedCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`✅ Linked ${linkedCount} project(s) to users`);
    console.log('='.repeat(60));

    if (needsConnectionString.length > 0) {
      console.log(`\n⚠️  ${needsConnectionString.length} project(s) need connection strings:`);
      console.log('\nTo get connection strings:');
      console.log('1. Go to https://console.neon.tech');
      console.log('2. Open each project');
      console.log('3. Copy the connection string from the project dashboard');
      console.log('4. Run this SQL to update:\n');
      
      needsConnectionString.forEach(({ user, userId, projectId, projectName }) => {
        console.log(`-- Update connection string for ${user} (${projectName})`);
        console.log(`UPDATE tenants SET neon_connection_string = 'YOUR_CONNECTION_STRING_HERE' WHERE user_id = ${userId};`);
        console.log('');
      });
    }

  } catch (error) {
    console.error('❌ Failed to link Neon tenants:', error.response?.data || error.message);
    throw error;
  } finally {
    client.release();
  }
}

// Run the script
linkNeonTenantsSimple()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

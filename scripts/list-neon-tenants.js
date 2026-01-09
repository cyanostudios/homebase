// scripts/list-neon-tenants.js
// Script to list all Neon projects and match them with users in the system

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const axios = require('axios');

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
      const response = await axios.get(
        `${this.baseUrl}/projects`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      return response.data.projects || [];
    } catch (error) {
      console.error('Failed to fetch Neon projects:', error.response?.data || error.message);
      throw error;
    }
  }

  async getProjectDatabases(projectId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/projects/${projectId}/databases`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      return response.data.databases || [];
    } catch (error) {
      console.error(`Failed to fetch databases for project ${projectId}:`, error.response?.data || error.message);
      return [];
    }
  }

  async getProjectConnectionStrings(projectId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/projects/${projectId}/connection_uris`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      return response.data.connection_uris || [];
    } catch (error) {
      console.error(`Failed to fetch connection strings for project ${projectId}:`, error.response?.data || error.message);
      return [];
    }
  }
}

async function listNeonTenants() {
  const client = await pool.connect();
  
  try {
    if (!process.env.NEON_API_KEY) {
      console.log('❌ NEON_API_KEY not set in .env.local');
      return;
    }

    console.log('🔍 Fetching Neon projects...\n');
    
    const neonService = new NeonService(process.env.NEON_API_KEY);
    const projects = await neonService.listProjects();

    if (projects.length === 0) {
      console.log('📭 No Neon projects found on this account.');
      return;
    }

    console.log(`📊 Found ${projects.length} Neon project(s):\n`);
    console.log('='.repeat(100));

    // Get all users and tenants from database
    const users = await client.query('SELECT id, email, role FROM users ORDER BY id');
    const tenants = await client.query('SELECT user_id, neon_project_id, neon_database_name FROM tenants');

    const tenantMap = new Map();
    tenants.rows.forEach(t => {
      tenantMap.set(t.neon_project_id, t);
    });

    const userMap = new Map();
    users.rows.forEach(u => {
      userMap.set(u.id, u);
    });

    for (const project of projects) {
      const projectId = project.id;
      const projectName = project.name;
      const region = project.region_id || 'unknown';
      const createdAt = project.created_at || 'unknown';
      
      // Check if this project is linked to a user
      const tenant = tenantMap.get(projectId);
      const isLinked = !!tenant;
      
      // Try to extract user ID from project name (format: homebase-tenant-{userId})
      const nameMatch = projectName.match(/homebase-tenant-(\d+)/);
      const extractedUserId = nameMatch ? parseInt(nameMatch[1]) : null;
      
      // Get databases for this project
      const databases = await neonService.getProjectDatabases(projectId);
      const connectionStrings = await neonService.getProjectConnectionStrings(projectId);
      
      console.log(`\n📦 Project: ${projectName}`);
      console.log(`   ID: ${projectId}`);
      console.log(`   Region: ${region}`);
      console.log(`   Created: ${createdAt}`);
      console.log(`   Status: ${isLinked ? '✅ Linked to system' : '⚠️  Not linked'}`);
      
      if (tenant) {
        const user = userMap.get(tenant.user_id);
        if (user) {
          console.log(`   👤 User: ${user.email} (ID: ${user.id}, Role: ${user.role})`);
          console.log(`   🗄️  Database: ${tenant.neon_database_name || 'N/A'}`);
        }
      } else if (extractedUserId) {
        const user = userMap.get(extractedUserId);
        if (user) {
          console.log(`   💡 Detected User ID: ${extractedUserId} (${user.email})`);
          console.log(`   ⚠️  This project is NOT linked in tenants table!`);
        } else {
          console.log(`   💡 Detected User ID: ${extractedUserId} (User not found in database)`);
        }
      }
      
      if (databases.length > 0) {
        console.log(`   📊 Databases (${databases.length}):`);
        databases.forEach(db => {
          console.log(`      - ${db.name} (ID: ${db.id})`);
        });
      }
      
      if (connectionStrings.length > 0) {
        const connStr = connectionStrings[0].connection_uri;
        const masked = connStr.replace(/:[^:@]+@/, ':****@');
        console.log(`   🔗 Connection: ${masked}`);
      }
      
      console.log('-'.repeat(100));
    }

    // Summary
    console.log('\n' + '='.repeat(100));
    console.log('📊 Summary:');
    console.log(`   Total Neon projects: ${projects.length}`);
    console.log(`   Linked to system: ${tenants.rows.length}`);
    console.log(`   Not linked: ${projects.length - tenants.rows.length}`);
    console.log('='.repeat(100));

    // Show unlinked projects
    const unlinkedProjects = projects.filter(p => !tenantMap.has(p.id));
    if (unlinkedProjects.length > 0) {
      console.log('\n⚠️  Unlinked Projects (not in tenants table):');
      unlinkedProjects.forEach(p => {
        const nameMatch = p.name.match(/homebase-tenant-(\d+)/);
        if (nameMatch) {
          const userId = parseInt(nameMatch[1]);
          const user = userMap.get(userId);
          if (user) {
            console.log(`   - ${p.name} (User ID: ${userId}, Email: ${user.email})`);
            console.log(`     💡 Run fix script to link this project to user ${userId}`);
          } else {
            console.log(`   - ${p.name} (User ID: ${userId} not found in database)`);
          }
        } else {
          console.log(`   - ${p.name} (Unknown format)`);
        }
      });
    }

  } catch (error) {
    console.error('❌ Failed to list Neon tenants:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run the script
listNeonTenants()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

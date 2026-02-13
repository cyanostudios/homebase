// scripts/create-test-user.js
// Script to create a test user with Neon database and specific plugin access

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// NeonService functionality (simplified for script)
class NeonService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://console.neon.tech/api/v2';
  }

  async createTenantDatabase(userId, userEmail) {
    try {
      const projectName = `homebase-tenant-${userId}`;
      const project = await this.createProject(projectName);

      const connectionString = project.connection_uris[0].connection_uri;

      await this.runMigrations(connectionString);

      return {
        projectId: project.project.id,
        databaseName: project.databases[0].name,
        connectionString: connectionString,
      };
    } catch (error) {
      console.error('Failed to create tenant database:', error.response?.data || error.message);
      throw error;
    }
  }

  async createProject(projectName) {
    const response = await axios.post(
      `${this.baseUrl}/projects`,
      {
        project: {
          name: projectName,
          region_id: 'aws-eu-central-1',
        },
      },
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      },
    );

    return response.data;
  }

  async runMigrations(connectionString) {
    const pool = new Pool({ connectionString });

    try {
      const migrationsDir = path.join(__dirname, '../server/migrations');

      if (!fs.existsSync(migrationsDir)) {
        console.log('⚠️  No migrations folder found, skipping migrations');
        return;
      }

      const migrationFiles = fs
        .readdirSync(migrationsDir)
        .filter((f) => f.endsWith('.sql'))
        .sort();

      console.log(`Running ${migrationFiles.length} migrations...`);

      for (const file of migrationFiles) {
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        console.log(`Executing migration: ${file}`);
        await pool.query(sql);
      }

      console.log('✅ All migrations completed successfully');
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    } finally {
      await pool.end();
    }
  }
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function createTestUser() {
  const client = await pool.connect();

  try {
    // Generate test credentials
    const email = `test-${Date.now()}@homebase.se`;
    const password = 'test123';

    console.log('👤 Creating test user...');
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Password: ${password}`);

    // Check if user exists
    const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      console.log('❌ User already exists');
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const userResult = await client.query(
      'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role',
      [email, passwordHash, 'user'],
    );

    const user = userResult.rows[0];
    console.log(`✅ User created with ID: ${user.id}`);

    // Create Neon tenant database
    if (!process.env.NEON_API_KEY) {
      console.log('⚠️  NEON_API_KEY not set, skipping Neon database creation');
      console.log('📝 User created but without Neon database. You can create it manually later.');
    } else {
      console.log('🗄️  Creating Neon database...');
      try {
        const neonService = new NeonService(process.env.NEON_API_KEY);
        const tenantDb = await neonService.createTenantDatabase(user.id, user.email);

        // Save tenant info
        await client.query(
          'INSERT INTO tenants (user_id, neon_project_id, neon_database_name, neon_connection_string) VALUES ($1, $2, $3, $4)',
          [user.id, tenantDb.projectId, tenantDb.databaseName, tenantDb.connectionString],
        );

        console.log(`✅ Neon database created: ${tenantDb.databaseName}`);
      } catch (error) {
        console.error('❌ Failed to create Neon database:', error.message);
        console.log('📝 User created but without Neon database. You can create it manually later.');
      }
    }

    // Give access to contacts and notes plugins only
    const plugins = ['contacts', 'notes'];
    for (const pluginName of plugins) {
      await client.query(
        'INSERT INTO user_plugin_access (user_id, plugin_name, enabled, granted_by) VALUES ($1, $2, true, $1)',
        [user.id, pluginName],
      );
    }

    console.log(`✅ Plugin access granted: ${plugins.join(', ')}`);

    console.log('\n' + '='.repeat(60));
    console.log('✅ TEST USER CREATED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Password: ${password}`);
    console.log(`👤 User ID: ${user.id}`);
    console.log(`🔌 Plugins: ${plugins.join(', ')}`);
    console.log('='.repeat(60));
    console.log('\n💡 You can now log in with these credentials!');

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to create test user:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run the script
createTestUser()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

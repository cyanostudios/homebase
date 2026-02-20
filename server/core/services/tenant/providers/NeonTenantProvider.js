// server/core/services/tenant/providers/NeonTenantProvider.js
// Neon-specific implementation of TenantService
// Database-per-tenant strategy using Neon projects

const TenantService = require('../TenantService');
const axios = require('axios');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

/**
 * NeonTenantProvider - Creates separate Neon projects for each tenant
 *
 * Strategy: Database-per-tenant
 * - Each tenant gets their own Neon project
 * - Complete data isolation
 * - Independent scaling and backups
 * - Higher cost but maximum isolation
 */
class NeonTenantProvider extends TenantService {
  constructor(config = {}) {
    super();
    this.apiKey = config.apiKey || process.env.NEON_API_KEY;
    this.baseUrl = config.baseUrl || 'https://console.neon.tech/api/v2';
    this.region = config.region || 'aws-eu-central-1'; // Frankfurt (closest to Sweden)
    this.mainPool = config.mainPool; // Railway pool for tenant metadata

    if (!this.apiKey) {
      throw new Error('NeonTenantProvider requires NEON_API_KEY');
    }
  }

  /**
   * Create a new Neon project for tenant
   */
  async createTenant(userId, userEmail) {
    try {
      console.log(`🔨 Creating Neon tenant for user ${userId} (${userEmail})`);

      // 1. Create Neon project
      const projectName = `homebase-tenant-${userId}`;
      const project = await this._createNeonProject(projectName);

      // 2. Get default database connection string
      const connectionString = project.connection_uris[0].connection_uri;

      // 3. Run migrations on new database
      await this._runMigrations(connectionString);

      const result = {
        projectId: project.project.id,
        databaseName: project.databases[0].name,
        connectionString: connectionString,
      };

      console.log(`✅ Neon tenant created: ${project.project.id}`);

      return result;
    } catch (error) {
      console.error('Failed to create Neon tenant:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Delete a Neon project
   */
  async deleteTenant(userId) {
    try {
      // Get project ID from database
      if (!this.mainPool) {
        throw new Error('mainPool not configured for NeonTenantProvider');
      }

      const result = await this.mainPool.query(
        'SELECT neon_project_id FROM tenants WHERE user_id = $1 OR owner_user_id = $1',
        [userId, userId],
      );

      if (result.rows.length === 0) {
        console.log(`⚠️  No Neon project found for user ${userId}`);
        return;
      }

      const projectId = result.rows[0].neon_project_id;

      await axios.delete(`${this.baseUrl}/projects/${projectId}`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      console.log(`✅ Deleted Neon project: ${projectId}`);
    } catch (error) {
      console.error('Failed to delete Neon project:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get connection string for tenant
   */
  async getTenantConnection(userId) {
    if (!this.mainPool) {
      throw new Error('mainPool not configured for NeonTenantProvider');
    }

    const result = await this.mainPool.query(
      'SELECT neon_connection_string FROM tenants WHERE user_id = $1 OR owner_user_id = $1',
      [userId, userId],
    );

    if (result.rows.length === 0) {
      throw new Error(`No tenant found for user ${userId}`);
    }

    return result.rows[0].neon_connection_string;
  }

  /**
   * List all Neon projects
   */
  async listTenants() {
    try {
      const response = await axios.get(`${this.baseUrl}/projects`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      return response.data.projects.map((p) => ({
        id: p.id,
        name: p.name,
        region: p.region_id,
        createdAt: new Date(p.created_at),
      }));
    } catch (error) {
      console.error('Failed to list Neon projects:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Check if tenant exists
   */
  async tenantExists(userId) {
    if (!this.mainPool) {
      throw new Error('mainPool not configured for NeonTenantProvider');
    }

    const result = await this.mainPool.query(
      'SELECT 1 FROM tenants WHERE user_id = $1 OR owner_user_id = $1',
      [userId],
    );

    return result.rows.length > 0;
  }

  /**
   * Get tenant metadata
   */
  async getTenantMetadata(userId) {
    if (!this.mainPool) {
      throw new Error('mainPool not configured for NeonTenantProvider');
    }

    const result = await this.mainPool.query(
      'SELECT neon_project_id, neon_database_name, neon_connection_string FROM tenants WHERE user_id = $1 OR owner_user_id = $1',
      [userId],
    );

    if (result.rows.length === 0) {
      throw new Error(`No tenant found for user ${userId}`);
    }

    return {
      projectId: result.rows[0].neon_project_id,
      databaseName: result.rows[0].neon_database_name,
      connectionString: result.rows[0].neon_connection_string,
    };
  }

  // ========== Private Methods ==========

  /**
   * Create Neon project via API
   * @private
   */
  async _createNeonProject(projectName) {
    const response = await axios.post(
      `${this.baseUrl}/projects`,
      {
        project: {
          name: projectName,
          region_id: this.region,
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

  /**
   * Run migrations on new tenant database
   * @private
   */
  async _runMigrations(connectionString) {
    const pool = new Pool({ connectionString });

    try {
      // Get all migration files
      const migrationsDir = path.join(__dirname, '../../../../migrations');

      // Skip if migrations folder doesn't exist
      if (!fs.existsSync(migrationsDir)) {
        console.log('⚠️  No migrations folder found, skipping migrations');
        return;
      }

      const migrationFiles = fs
        .readdirSync(migrationsDir)
        .filter((f) => f.endsWith('.sql'))
        .sort();

      console.log(`   Running ${migrationFiles.length} migrations...`);

      for (const file of migrationFiles) {
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        console.log(`   Executing migration: ${file}`);
        await pool.query(sql);
      }

      console.log('   ✅ All migrations completed');
    } catch (error) {
      console.error('   ❌ Migration failed:', error);
      throw error;
    } finally {
      await pool.end();
    }
  }
}

module.exports = NeonTenantProvider;

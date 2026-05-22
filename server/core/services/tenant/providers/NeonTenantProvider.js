// server/core/services/tenant/providers/NeonTenantProvider.js
// Neon-specific implementation of TenantService
// Database-per-tenant strategy using Neon projects

const TenantService = require('../TenantService');
const axios = require('axios');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { upsertTenantRecord, ensureTenantMembership } = require('../../../utils/tenantMainDb');

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

      const projectId = project.project.id;
      const databaseName = project.databases?.[0]?.name || 'neondb';
      const connectionString = await this._resolveConnectionString(project, projectId);

      // 3. Run migrations on new tenant database
      await this._runMigrations(connectionString);

      const result = {
        projectId,
        databaseName,
        connectionString,
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
        [userId],
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
      [userId],
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

    try {
      const result = await this.mainPool.query(
        'SELECT 1 FROM tenants WHERE user_id = $1 OR owner_user_id = $1',
        [userId],
      );
      return result.rows.length > 0;
    } catch (err) {
      if (err?.code !== '42703') throw err;
      const result = await this.mainPool.query('SELECT 1 FROM tenants WHERE user_id = $1', [
        userId,
      ]);
      return result.rows.length > 0;
    }
  }

  /**
   * Link main-DB tenants row to existing Neon project homebase-tenant-{userId} (signup repair / login).
   * @returns {Promise<{ tenantId, tenantRole, tenantConnectionString, tenantOwnerUserId }|null>}
   */
  async linkNeonTenantForUser(userId) {
    const projectName = `homebase-tenant-${userId}`;
    const projects = await this.listTenants();
    const match = projects.find((p) => p.name === projectName);
    if (!match) {
      console.log(`⚠️  No Neon project named ${projectName}`);
      return null;
    }

    const { connectionString, databaseName } = await this._fetchConnectionForProject(match.id);
    if (!connectionString) return null;

    const UserService = require('../../user/UserService');
    const db = new UserService()._getPool();

    const tenantId = await upsertTenantRecord(db, {
      userId,
      projectId: match.id,
      databaseName,
      connectionString,
    });
    await ensureTenantMembership(db, tenantId, userId);

    console.log(`✅ Linked Neon tenant ${match.id} to user ${userId} (tenant_id=${tenantId})`);

    return {
      tenantId,
      tenantRole: 'admin',
      tenantConnectionString: connectionString,
      tenantOwnerUserId: userId,
    };
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

  async _resolveConnectionString(createProjectPayload, projectId) {
    const fromCreate = createProjectPayload?.connection_uris?.[0]?.connection_uri;
    if (fromCreate) return fromCreate;
    return (await this._fetchConnectionForProject(projectId)).connectionString;
  }

  async _fetchConnectionForProject(projectId) {
    const headers = { Authorization: `Bearer ${this.apiKey}` };
    const branchesRes = await axios.get(`${this.baseUrl}/projects/${projectId}/branches`, {
      headers,
    });
    const branches = branchesRes.data?.branches || [];
    const branch = branches.find((b) => b.primary) || branches[0];
    if (!branch?.id) throw new Error(`No branch for Neon project ${projectId}`);

    const rolesRes = await axios.get(
      `${this.baseUrl}/projects/${projectId}/branches/${branch.id}/roles`,
      { headers },
    );
    const roleName = rolesRes.data?.roles?.[0]?.name;
    if (!roleName) throw new Error(`No role for Neon project ${projectId}`);

    const databaseName = branch.databases?.[0]?.name || 'neondb';

    const connRes = await axios.get(`${this.baseUrl}/projects/${projectId}/connection_uri`, {
      headers,
      params: {
        branch_id: branch.id,
        database_name: databaseName,
        role_name: roleName,
        pooled: true,
      },
    });

    const connectionString = connRes.data?.uri || connRes.data?.connection_uri;
    if (!connectionString) {
      throw new Error(`Neon API returned no connection URI for project ${projectId}`);
    }

    return { connectionString, databaseName };
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

// server/core/services/tenant/providers/LocalTenantProvider.js
// Local development implementation of TenantService
// Schema-per-tenant strategy using local Postgres

const TenantService = require('../TenantService');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const MAIN_DB_MIGRATIONS = new Set(['028-user-settings.sql', '037-fx-rates.sql']);

/**
 * LocalTenantProvider - Creates separate schemas for each tenant in local Postgres
 * 
 * Strategy: Schema-per-tenant
 * - Each tenant gets their own schema in the same database
 * - Good data isolation with lower overhead
 * - Perfect for local development (no Neon API key needed)
 * - Can also be used in production for self-hosted deployments
 */
class LocalTenantProvider extends TenantService {
  constructor(config = {}) {
    super();
    this.connectionString = config.connectionString || process.env.DATABASE_URL;
    this.mainPool = config.mainPool || new Pool({ connectionString: this.connectionString });
    
    if (!this.connectionString) {
      throw new Error('LocalTenantProvider requires DATABASE_URL');
    }
  }

  /**
   * Create a new schema for tenant
   */
  async createTenant(userId, userEmail) {
    try {
      console.log(`🔨 Creating local tenant schema for user ${userId} (${userEmail})`);
      
      const schemaName = `tenant_${userId}`;
      const client = await this.mainPool.connect();
      
      try {
        // 1. Create schema
        await client.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
        console.log(`   Created schema: ${schemaName}`);
        
        // 2. Set strict tenant-only search_path.
        await client.query(`SET search_path TO ${schemaName}`);
        
        // 3. Run migrations in the schema
        await this._runMigrations(client, schemaName);
        
        // 4. Create connection string with schema
        // IMPORTANT: When using Neon Postgres via the pooler, startup "options" like search_path are not supported.
        // We return the base connection string and rely on the DB adapter to SET search_path per query.
        const tenantConnectionString = `${this.connectionString}`;
        
        console.log(`✅ Local tenant created: ${schemaName}`);
        
        return {
          projectId: schemaName, // Use schema name as project ID
          databaseName: schemaName,
          connectionString: tenantConnectionString,
        };
      } finally {
        try {
          await client.query('RESET search_path');
        } catch {}
        client.release();
      }
    } catch (error) {
      console.error('Failed to create local tenant:', error.message);
      throw error;
    }
  }

  /**
   * Delete a tenant schema
   */
  async deleteTenant(userId) {
    try {
      const schemaName = `tenant_${userId}`;
      
      await this.mainPool.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
      
      console.log(`✅ Deleted local tenant schema: ${schemaName}`);
    } catch (error) {
      console.error('Failed to delete local tenant:', error.message);
      throw error;
    }
  }

  /**
   * Get connection string for tenant
   */
  async getTenantConnection(userId) {
    const schemaName = `tenant_${userId}`;
    
    // Check if schema exists
    const result = await this.mainPool.query(
      `SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1`,
      [schemaName]
    );
    
    if (result.rows.length === 0) {
      throw new Error(`No tenant schema found for user ${userId}`);
    }
    
    // See note above: return base connection string; adapter handles search_path.
    return `${this.connectionString}`;
  }

  /**
   * List all tenant schemas
   */
  async listTenants() {
    const result = await this.mainPool.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name LIKE 'tenant_%'
      ORDER BY schema_name
    `);
    
    return result.rows.map(row => {
      const userId = parseInt(row.schema_name.replace('tenant_', ''));
      return {
        id: row.schema_name,
        userId: userId,
        name: row.schema_name,
        createdAt: null, // Schema creation time not easily available
      };
    });
  }

  /**
   * Check if tenant exists
   */
  async tenantExists(userId) {
    const schemaName = `tenant_${userId}`;
    
    const result = await this.mainPool.query(
      `SELECT 1 FROM information_schema.schemata WHERE schema_name = $1`,
      [schemaName]
    );
    
    return result.rows.length > 0;
  }

  /**
   * Get tenant metadata
   */
  async getTenantMetadata(userId) {
    const schemaName = `tenant_${userId}`;
    
    const result = await this.mainPool.query(
      `SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1`,
      [schemaName]
    );
    
    if (result.rows.length === 0) {
      throw new Error(`No tenant schema found for user ${userId}`);
    }
    
    return {
      projectId: schemaName,
      databaseName: schemaName,
      connectionString: `${this.connectionString}`,
    };
  }

  // ========== Private Methods ==========

  /**
   * Run migrations in tenant schema
   * @private
   */
  async _runMigrations(client, schemaName) {
    try {
      // Get all migration files
      const migrationsDir = path.join(__dirname, '../../../../migrations');
      
      // Skip if migrations folder doesn't exist
      if (!fs.existsSync(migrationsDir)) {
        console.log('⚠️  No migrations folder found, skipping migrations');
        return;
      }
      
      const migrationFiles = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

      console.log(`   Running ${migrationFiles.length} migrations in ${schemaName}...`);

      for (const file of migrationFiles) {
        if (MAIN_DB_MIGRATIONS.has(file)) {
          console.log(`   Skipping main-db migration for tenant schema: ${file}`);
          continue;
        }

        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        console.log(`   Executing migration: ${file}`);
        
        // Execute in strict tenant schema.
        await client.query(`SET search_path TO ${schemaName}`);
        await client.query(sql);
      }

      console.log('   ✅ All migrations completed');
    } catch (error) {
      console.error('   ❌ Migration failed:', error);
      throw error;
    }
  }

  /**
   * Close the main pool (for cleanup)
   */
  async close() {
    await this.mainPool.end();
  }
}

module.exports = LocalTenantProvider;

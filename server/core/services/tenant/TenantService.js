// server/core/services/tenant/TenantService.js
// Abstract interface for tenant provisioning
// Implementations: Neon, Supabase, Local, Shared Database

/**
 * TenantService - Abstract interface for multi-tenancy strategies
 *
 * This service handles the creation, deletion, and management of tenant databases.
 * Different providers implement different multi-tenancy strategies:
 *
 * - NeonTenantProvider: Database-per-tenant using Neon projects
 * - SupabaseTenantProvider: Database-per-tenant using Supabase projects
 * - LocalTenantProvider: Schema-per-tenant in local Postgres
 * - SharedDatabaseProvider: Single database with tenant_id filtering
 */
class TenantService {
  /**
   * Create a new tenant database/schema
   * @param {number} userId - User ID to create tenant for
   * @param {string} userEmail - User email for naming/logging
   * @returns {Promise<{projectId: string, databaseName: string, connectionString: string}>}
   */
  async createTenant(userId, userEmail) {
    throw new Error('TenantService.createTenant() must be implemented by provider');
  }

  /**
   * Delete a tenant database/schema
   * @param {number} userId - User ID to delete tenant for
   * @returns {Promise<void>}
   */
  async deleteTenant(userId) {
    throw new Error('TenantService.deleteTenant() must be implemented by provider');
  }

  /**
   * Get connection string for a tenant
   * @param {number} userId - User ID to get connection for
   * @returns {Promise<string>} - Connection string
   */
  async getTenantConnection(userId) {
    throw new Error('TenantService.getTenantConnection() must be implemented by provider');
  }

  /**
   * List all tenant projects/schemas
   * @returns {Promise<Array<{id: string, userId: number, name: string, createdAt: Date}>>}
   */
  async listTenants() {
    throw new Error('TenantService.listTenants() must be implemented by provider');
  }

  /**
   * Check if tenant exists
   * @param {number} userId - User ID to check
   * @returns {Promise<boolean>}
   */
  async tenantExists(userId) {
    throw new Error('TenantService.tenantExists() must be implemented by provider');
  }

  /**
   * Get tenant metadata
   * @param {number} userId - User ID
   * @returns {Promise<{projectId: string, databaseName: string, region?: string, createdAt?: Date}>}
   */
  async getTenantMetadata(userId) {
    throw new Error('TenantService.getTenantMetadata() must be implemented by provider');
  }
}

module.exports = TenantService;

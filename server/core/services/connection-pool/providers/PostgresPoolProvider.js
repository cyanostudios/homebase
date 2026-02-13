// server/core/services/connection-pool/providers/PostgresPoolProvider.js
// PostgreSQL connection pool provider with automatic cleanup
// Direct pg.Pool management with idle timeout and periodic cleanup

const ConnectionPoolService = require('../ConnectionPoolService');
const { Pool } = require('pg');

/**
 * PostgresPoolProvider - Manages pg.Pool instances for tenant databases
 *
 * Features:
 * - Pool caching and reuse
 * - Automatic cleanup of inactive pools (24h idle time)
 * - Graceful shutdown support
 * - Pool statistics and monitoring
 */
class PostgresPoolProvider extends ConnectionPoolService {
  constructor(config = {}) {
    super();

    // Pool configuration
    this.poolConfig = {
      max: config.max || 10,
      idleTimeoutMillis: config.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: config.connectionTimeoutMillis || 2000,
    };

    // Cleanup configuration
    this.cleanupInterval = config.cleanupInterval || 60 * 60 * 1000; // 1 hour
    this.maxPoolAge = config.maxPoolAge || 24 * 60 * 60 * 1000; // 24 hours

    // Pool registry
    this.tenantPools = new Map();

    // Start automatic cleanup
    this._startCleanupTimer();
  }

  /**
   * Get or create a connection pool for tenant
   */
  getTenantPool(connectionString) {
    const now = Date.now();

    if (!this.tenantPools.has(connectionString)) {
      console.log(
        `🔌 Creating new tenant pool for: ${this._maskConnectionString(connectionString)}`,
      );

      const pool = new Pool({
        connectionString,
        ...this.poolConfig,
      });

      this.tenantPools.set(connectionString, {
        pool,
        lastAccessed: now,
        createdAt: now,
      });
    }

    // Update last accessed time
    const tenantPoolEntry = this.tenantPools.get(connectionString);
    tenantPoolEntry.lastAccessed = now;

    return tenantPoolEntry.pool;
  }

  /**
   * Close a specific tenant pool
   */
  async closeTenantPool(connectionString) {
    const entry = this.tenantPools.get(connectionString);

    if (!entry) {
      return; // Pool doesn't exist
    }

    try {
      await entry.pool.end();
      this.tenantPools.delete(connectionString);
      console.log(`✅ Closed tenant pool: ${this._maskConnectionString(connectionString)}`);
    } catch (error) {
      console.error(`❌ Error closing tenant pool: ${error.message}`);
      throw error;
    }
  }

  /**
   * Close all tenant pools (for graceful shutdown)
   */
  async closeAllPools() {
    console.log(`📊 Closing ${this.tenantPools.size} active pool(s)...`);

    const poolsToClose = Array.from(this.tenantPools.entries());

    await Promise.all(
      poolsToClose.map(async ([connectionString, entry]) => {
        const dbHost = this._maskConnectionString(connectionString);
        console.log(`   Closing pool: ${dbHost}`);

        try {
          await entry.pool.end();
          console.log(`   ✅ Closed: ${dbHost}`);
        } catch (err) {
          console.error(`   ❌ Error closing ${dbHost}:`, err.message);
        }
      }),
    );

    this.tenantPools.clear();
    console.log('✅ All tenant pools closed');

    // Stop cleanup timer
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }

  /**
   * Get statistics for all pools
   */
  getPoolStats() {
    const now = Date.now();
    const stats = [];

    for (const [connectionString, entry] of this.tenantPools.entries()) {
      const idleTimeMs = now - entry.lastAccessed;
      const ageMs = now - entry.createdAt;
      const idleTimeHours = (idleTimeMs / (1000 * 60 * 60)).toFixed(1);

      stats.push({
        tenant: this._maskConnectionString(connectionString),
        idleTimeMs,
        idleTimeHours: `${idleTimeHours}h`,
        ageMs,
        willCleanupIn:
          idleTimeMs > this.maxPoolAge
            ? 'next cleanup cycle'
            : `${((this.maxPoolAge - idleTimeMs) / (1000 * 60 * 60)).toFixed(1)}h`,
        poolSize: entry.pool.totalCount || 0,
        idleConnections: entry.pool.idleCount || 0,
        waitingClients: entry.pool.waitingCount || 0,
      });
    }

    // Sort by most recently used
    stats.sort((a, b) => a.idleTimeMs - b.idleTimeMs);

    return {
      total: this.tenantPools.size,
      active: stats.filter((s) => s.idleTimeMs < 60 * 60 * 1000).length, // Active in last hour
      idle: stats.filter((s) => s.idleTimeMs >= 60 * 60 * 1000).length,
      details: stats,
    };
  }

  /**
   * Run cleanup of inactive pools
   */
  async cleanupInactivePools() {
    const now = Date.now();
    let cleanedCount = 0;

    console.log('🧹 Running tenant pool cleanup...');

    for (const [connectionString, entry] of this.tenantPools.entries()) {
      if (now - entry.lastAccessed > this.maxPoolAge) {
        console.log(`🗑️ Closing inactive pool: ${this._maskConnectionString(connectionString)}`);

        // Gracefully close the pool
        try {
          await entry.pool.end();
          this.tenantPools.delete(connectionString);
          cleanedCount++;
        } catch (err) {
          console.error('Error closing pool during cleanup:', err.message);
        }
      }
    }

    if (cleanedCount > 0) {
      console.log(`✨ Released ${cleanedCount} inactive database pools`);
    }

    return cleanedCount;
  }

  /**
   * Get pool for specific connection string (if exists)
   */
  getExistingPool(connectionString) {
    const entry = this.tenantPools.get(connectionString);
    return entry ? entry.pool : null;
  }

  /**
   * Check if pool exists for connection string
   */
  hasPool(connectionString) {
    return this.tenantPools.has(connectionString);
  }

  // ========== Private Methods ==========

  /**
   * Start automatic cleanup timer
   * @private
   */
  _startCleanupTimer() {
    this.cleanupTimer = setInterval(() => {
      this.cleanupInactivePools().catch((err) => {
        console.error('Error during automatic pool cleanup:', err);
      });
    }, this.cleanupInterval);

    // Don't keep process alive just for cleanup timer
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Mask connection string for logging (hide password)
   * @private
   */
  _maskConnectionString(connectionString) {
    try {
      const url = new URL(connectionString);
      return `${url.hostname}:${url.port}${url.pathname}`;
    } catch {
      // Fallback if URL parsing fails
      return connectionString.split('@')[1]?.split('/')[0] || 'unknown';
    }
  }
}

module.exports = PostgresPoolProvider;

// server/core/services/database/adapters/PostgreSQLAdapter.js
// PostgreSQL adapter with automatic tenant isolation

const DatabaseService = require('../DatabaseService');
const { AppError } = require('../../../errors/AppError');

class PostgreSQLAdapter extends DatabaseService {
  constructor(pool, logger) {
    super();
    this.pool = pool;
    this.logger = logger;
  }

  /**
   * Get tenant context from request
   */
  _getContext(req) {
    return {
      tenantId: req?.session?.tenantId,
      tenantSchemaName: req?.session?.tenantSchemaName || null,
      pool: req?.tenantPool || this.pool,
    };
  }

  /**
   * Add tenant isolation to SQL query
   * Tenant data is isolated by schema/database, not row-level user_id.
   */
  _addTenantFilter(sql, _tenantId) {
    return sql;
  }

  /**
   * Count parameter placeholders in SQL
   * Returns the maximum parameter number (e.g., if $1, $2, $2 exist, returns 2)
   * This handles cases where the same parameter is reused multiple times
   */
  _getParamCount(sql) {
    const matches = sql.match(/\$\d+/g);
    if (!matches) return 0;

    // Find the maximum parameter number
    const maxParam = Math.max(...matches.map((m) => parseInt(m.substring(1))));
    return maxParam;
  }

  /**
   * Validate SQL query for security
   */
  _validateQuery(sql, params) {
    if (typeof sql !== 'string') {
      throw new AppError('SQL query must be a string', 400, AppError.CODES.BAD_REQUEST);
    }

    if (!Array.isArray(params)) {
      throw new AppError('Query parameters must be an array', 400, AppError.CODES.BAD_REQUEST);
    }

    // Detect potential SQL injection patterns
    const suspiciousPatterns = [
      /;\s*DROP\s+TABLE/i,
      /;\s*DELETE\s+FROM/i,
      /;\s*TRUNCATE/i,
      // /UNION\s+SELECT/i - removed: causes false positives for legitimate UNION queries (e.g. Fyndiq export)
      /--/,
      /\/\*/,
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(sql)) {
        this.logger?.warn('Potential SQL injection detected', { sql: sql.substring(0, 100) });
        throw new AppError('Invalid query detected', 400, AppError.CODES.BAD_REQUEST);
      }
    }

    // Ensure parameterized queries (check for string interpolation)
    const paramCount = this._getParamCount(sql);
    if (paramCount !== params.length) {
      throw new AppError(
        `Parameter count mismatch: expected ${paramCount}, got ${params.length}`,
        400,
        AppError.CODES.BAD_REQUEST,
      );
    }
  }

  async query(sql, params = [], context = {}) {
    this._validateQuery(sql, params);

    const pool = context.pool || this.pool;
    const tenantId = context.tenantId;
    const tenantSchemaName = context.tenantSchemaName;

    // Add tenant isolation
    let finalSql = sql;
    let finalParams = [...params];

    if (tenantId) {
      finalSql = this._addTenantFilter(sql, tenantId);
      if (finalSql !== sql) {
        finalParams = [...params, tenantId];
      }
    }

    try {
      const startTime = Date.now();

      // Log SQL query details without exposing parameter values.
      this.logger?.info('Executing SQL query', {
        sql: finalSql,
        tenantId: tenantId,
        paramCount: finalParams.length,
      });

      // LocalTenantProvider uses schema-per-tenant. Tenant data lives only in tenant schema.
      //
      // IMPORTANT (Neon pooler / transaction pooling):
      // search_path is session-local. With poolers, state may not persist across statements.
      // We therefore run `BEGIN; SET LOCAL search_path ...; <query>; COMMIT;` to guarantee
      // the query executes with the intended schema on the same backend connection.
      const isLocalProvider = process.env.TENANT_PROVIDER === 'local';

      if (tenantSchemaName && isLocalProvider) {
        const schemaName = tenantSchemaName;
        this.logger?.info('Setting search_path for tenant query', { schemaName, tenantId });

        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          try {
            await client.query(`SET LOCAL search_path TO ${schemaName}`);

            const result = await client.query(finalSql, finalParams);
            await client.query('COMMIT');

            const duration = Date.now() - startTime;

            this.logger?.info('SQL query completed', {
              duration,
              rowCount: result.rows?.length || 0,
              sql: finalSql.substring(0, 200),
            });

            if (duration > 1000) {
              this.logger?.warn('Slow query detected', {
                duration,
                sql: finalSql.substring(0, 100),
              });
            }

            return result.rows;
          } catch (inner) {
            try {
              await client.query('ROLLBACK');
            } catch {}
            throw inner;
          }
        } finally {
          client.release();
        }
      }

      // If we didn't use a client above (no tenant pool), execute normally
      const result = await pool.query(finalSql, finalParams);
      const duration = Date.now() - startTime;

      // Log query result
      this.logger?.info('SQL query completed', {
        duration,
        rowCount: result.rows?.length || 0,
        sql: finalSql.substring(0, 200),
      });

      // Log slow queries
      if (duration > 1000) {
        this.logger?.warn('Slow query detected', {
          duration,
          sql: finalSql.substring(0, 100),
        });
      }

      return result.rows;
    } catch (error) {
      this.logger?.error('Database query failed', error, {
        sql: finalSql.substring(0, 100),
        paramCount: finalParams.length,
      });
      throw new AppError('Database query failed', 500, AppError.CODES.DATABASE_ERROR, {
        originalError: error.message,
        code: error.code,
        constraint: error.constraint,
      });
    }
  }

  async transaction(callback, context = {}) {
    const pool = context.pool || this.pool;
    const tenantSchemaName = context.tenantSchemaName;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const isLocalProvider = process.env.TENANT_PROVIDER === 'local';
      if (tenantSchemaName && isLocalProvider) {
        await client.query(`SET LOCAL search_path TO ${tenantSchemaName}`);
      }
      const result = await callback({
        query: async (sql, params = []) => {
          this._validateQuery(sql, params);
          const res = await client.query(sql, params);
          return res.rows;
        },
      });
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger?.error('Transaction failed', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async insert(table, data, context = {}) {
    const pool = context.pool || this.pool;
    const tenantId = context.tenantId;
    const tenantSchemaName = context.tenantSchemaName;

    if (!tenantId) {
      throw new AppError('Tenant context required for insert', 400, AppError.CODES.BAD_REQUEST);
    }

    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const columnNames = columns.join(', ');

    const sql = `
      INSERT INTO ${table} (${columnNames})
      VALUES (${placeholders})
      RETURNING *
    `;

    const params = [...values];

    // Log INSERT details without exposing parameter values.
    this.logger?.info('Executing INSERT query', {
      sql: sql.trim(),
      tenantId: tenantId,
      table: table,
      columnCount: columns.length,
      paramCount: params.length,
      dataKeys: columns,
    });

    try {
      const startTime = Date.now();

      // For LocalTenantProvider, set search_path to tenant schema only. See query() for rationale.
      const isLocalProvider = process.env.TENANT_PROVIDER === 'local';
      let result;
      if (tenantSchemaName && isLocalProvider) {
        const schemaName = tenantSchemaName;
        this.logger?.info('Setting search_path for tenant insert', { schemaName, tenantId });
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          try {
            await client.query(`SET LOCAL search_path TO ${schemaName}`);
            result = await client.query(sql, params);
            await client.query('COMMIT');
          } catch (inner) {
            try {
              await client.query('ROLLBACK');
            } catch {}
            throw inner;
          }
        } finally {
          client.release();
        }
      } else {
        result = await pool.query(sql, params);
      }

      const duration = Date.now() - startTime;

      this.logger?.info('INSERT query completed', {
        duration,
        table,
        rowCount: result.rows?.length || 0,
        insertedId: result.rows?.[0]?.id,
      });

      return result.rows[0];
    } catch (error) {
      // Enhanced error logging without parameter values.
      this.logger?.error('INSERT failed - DETAILED ERROR', error, {
        table,
        sql: sql.trim(),
        paramCount: params.length,
        tenantId: tenantId,
        dataKeys: columns,
        errorCode: error.code,
        errorMessage: error.message,
        errorDetail: error.detail,
        errorHint: error.hint,
        errorPosition: error.position,
        errorSchema: error.schema,
        errorTable: error.table,
        errorColumn: error.column,
        errorConstraint: error.constraint,
        stackTrace: error.stack?.substring(0, 1000),
      });

      // Preserve original PostgreSQL error details
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        `Failed to insert into ${table}: ${error.message || 'Unknown error'}`,
        500,
        AppError.CODES.DATABASE_ERROR,
        {
          originalError: error.message,
          errorCode: error.code,
          errorDetail: error.detail,
          errorHint: error.hint,
          table: table,
          constraint: error.constraint,
        },
      );
    }
  }

  async update(table, id, data, context = {}) {
    const pool = context.pool || this.pool;
    const tenantId = context.tenantId;
    const tenantSchemaName = context.tenantSchemaName;

    if (!tenantId) {
      throw new AppError('Tenant context required for update', 400, AppError.CODES.BAD_REQUEST);
    }

    const columns = Object.keys(data);
    const values = Object.values(data);
    const hasUpdatedAt = columns.some((c) => c.toLowerCase() === 'updated_at');
    const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
    const updatedAtClause = hasUpdatedAt ? '' : ', updated_at = CURRENT_TIMESTAMP';

    const sql = `
      UPDATE ${table}
      SET ${setClause}${updatedAtClause}
      WHERE id = $${values.length + 1}
      RETURNING *
    `;

    const params = [...values, id];

    try {
      // For LocalTenantProvider, set search_path to tenant schema only. See query() for rationale.
      const isLocalProvider = process.env.TENANT_PROVIDER === 'local';
      let result;
      if (tenantSchemaName && isLocalProvider) {
        const schemaName = tenantSchemaName;
        this.logger?.info('Setting search_path for tenant update', { schemaName, tenantId });
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          try {
            await client.query(`SET LOCAL search_path TO ${schemaName}`);
            result = await client.query(sql, params);
            await client.query('COMMIT');
          } catch (inner) {
            try {
              await client.query('ROLLBACK');
            } catch {}
            throw inner;
          }
        } finally {
          client.release();
        }
      } else {
        result = await pool.query(sql, params);
      }

      if (result.rows.length === 0) {
        throw new AppError(`${table} not found`, 404, AppError.CODES.NOT_FOUND);
      }
      return result.rows[0];
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      this.logger?.error('Update failed', error, { table, id });
      throw new AppError(`Failed to update ${table}`, 500, AppError.CODES.DATABASE_ERROR, {
        originalError: error.message,
      });
    }
  }

  async delete(table, id, context = {}) {
    const pool = context.pool || this.pool;
    const tenantId = context.tenantId;
    const tenantSchemaName = context.tenantSchemaName;

    if (!tenantId) {
      throw new AppError('Tenant context required for delete', 400, AppError.CODES.BAD_REQUEST);
    }

    const sql = `
      DELETE FROM ${table}
      WHERE id = $1
      RETURNING id
    `;

    try {
      // For LocalTenantProvider, set search_path to tenant schema only. See query() for rationale.
      const isLocalProvider = process.env.TENANT_PROVIDER === 'local';
      let result;
      if (tenantSchemaName && isLocalProvider) {
        const schemaName = tenantSchemaName;
        this.logger?.info('Setting search_path for tenant delete', { schemaName, tenantId });
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          try {
            await client.query(`SET LOCAL search_path TO ${schemaName}`);
            result = await client.query(sql, [id]);
            await client.query('COMMIT');
          } catch (inner) {
            try {
              await client.query('ROLLBACK');
            } catch {}
            throw inner;
          }
        } finally {
          client.release();
        }
      } else {
        result = await pool.query(sql, [id]);
      }
      if (result.rows.length === 0) {
        throw new AppError(`${table} not found`, 404, AppError.CODES.NOT_FOUND);
      }
      return { id: result.rows[0].id };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      this.logger?.error('Delete failed', error, { table, id });
      throw new AppError(`Failed to delete from ${table}`, 500, AppError.CODES.DATABASE_ERROR, {
        originalError: error.message,
      });
    }
  }
}

module.exports = PostgreSQLAdapter;

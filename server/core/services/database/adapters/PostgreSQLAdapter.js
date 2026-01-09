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
      userId: req?.session?.currentTenantUserId || req?.session?.user?.id,
      tenantId: req?.session?.tenantId,
      pool: req?.tenantPool || this.pool,
    };
  }

  /**
   * Add tenant isolation to SQL query
   * Automatically adds WHERE user_id = ? clause if not present
   */
  _addTenantFilter(sql, userId) {
    if (!userId) {
      return sql; // No user context, return as-is (for system queries)
    }

    const upperSql = sql.toUpperCase().trim();
    
    // Skip if already has user_id filter
    if (upperSql.includes('USER_ID')) {
      return sql;
    }

    // For SELECT queries, add WHERE clause
    if (upperSql.startsWith('SELECT')) {
      // Find the position of ORDER BY, GROUP BY, LIMIT, OFFSET (these must come after WHERE)
      const orderByIndex = upperSql.indexOf(' ORDER BY ');
      const groupByIndex = upperSql.indexOf(' GROUP BY ');
      const limitIndex = upperSql.indexOf(' LIMIT ');
      const offsetIndex = upperSql.indexOf(' OFFSET ');
      
      // Find the last clause that must come after WHERE
      const lastClauseIndex = Math.max(
        orderByIndex === -1 ? -1 : orderByIndex,
        groupByIndex === -1 ? -1 : groupByIndex,
        limitIndex === -1 ? -1 : limitIndex,
        offsetIndex === -1 ? -1 : offsetIndex
      );
      
      const whereIndex = upperSql.indexOf(' WHERE ');
      if (whereIndex === -1) {
        // No WHERE clause
        if (lastClauseIndex === -1) {
          // No ORDER BY, GROUP BY, LIMIT, OFFSET - just add WHERE at the end
          return `${sql} WHERE user_id = $${this._getParamCount(sql) + 1}`;
        } else {
          // Has ORDER BY/GROUP BY/LIMIT/OFFSET - insert WHERE before them
          const insertPos = sql.toUpperCase().indexOf(upperSql.substring(lastClauseIndex, lastClauseIndex + 10));
          const beforeClause = sql.substring(0, insertPos);
          const afterClause = sql.substring(insertPos);
          return `${beforeClause} WHERE user_id = $${this._getParamCount(sql) + 1} ${afterClause}`;
        }
      } else {
        // Has WHERE clause, add AND
        if (lastClauseIndex === -1 || whereIndex < lastClauseIndex) {
          // WHERE comes before ORDER BY/etc, or there are no other clauses
          return sql.replace(/ WHERE /i, ` WHERE user_id = $${this._getParamCount(sql) + 1} AND `);
        } else {
          // WHERE comes after ORDER BY/etc (shouldn't happen, but handle it)
          return sql.replace(/ WHERE /i, ` WHERE user_id = $${this._getParamCount(sql) + 1} AND `);
        }
      }
    }

    // For UPDATE/DELETE, add WHERE clause if not present
    if (upperSql.startsWith('UPDATE') || upperSql.startsWith('DELETE')) {
      const whereIndex = upperSql.indexOf('WHERE');
      if (whereIndex === -1) {
        // No WHERE clause - this is dangerous, but we'll add user_id filter
        return `${sql} WHERE user_id = $${this._getParamCount(sql) + 1}`;
      } else {
        // Check if user_id already in WHERE
        if (!upperSql.includes('USER_ID')) {
          return `${sql} AND user_id = $${this._getParamCount(sql) + 1}`;
        }
      }
    }

    return sql;
  }

  /**
   * Count parameter placeholders in SQL
   */
  _getParamCount(sql) {
    const matches = sql.match(/\$\d+/g);
    return matches ? matches.length : 0;
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
      /UNION\s+SELECT/i,
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
        AppError.CODES.BAD_REQUEST
      );
    }
  }

  async query(sql, params = [], context = {}) {
    this._validateQuery(sql, params);

    const pool = context.pool || this.pool;
    const userId = context.userId;

    // Add tenant isolation
    let finalSql = sql;
    let finalParams = [...params];

    if (userId) {
      finalSql = this._addTenantFilter(sql, userId);
      if (finalSql !== sql) {
        // Tenant filter was added, append userId to params
        finalParams = [...params, userId];
      }
    }

    try {
      const startTime = Date.now();
      const result = await pool.query(finalSql, finalParams);
      const duration = Date.now() - startTime;

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
      throw new AppError(
        'Database query failed',
        500,
        AppError.CODES.DATABASE_ERROR,
        { originalError: error.message }
      );
    }
  }

  async transaction(callback, context = {}) {
    const pool = context.pool || this.pool;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
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
    const userId = context.userId;

    if (!userId) {
      throw new AppError('User context required for insert', 400, AppError.CODES.BAD_REQUEST);
    }

    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const columnNames = columns.join(', ');

    const sql = `
      INSERT INTO ${table} (${columnNames}, user_id)
      VALUES (${placeholders}, $${values.length + 1})
      RETURNING *
    `;

    const params = [...values, userId];

    try {
      const result = await pool.query(sql, params);
      return result.rows[0];
    } catch (error) {
      this.logger?.error('Insert failed', error, { table, dataKeys: columns });
      throw new AppError(
        `Failed to insert into ${table}`,
        500,
        AppError.CODES.DATABASE_ERROR,
        { originalError: error.message }
      );
    }
  }

  async update(table, id, data, context = {}) {
    const pool = context.pool || this.pool;
    const userId = context.userId;

    if (!userId) {
      throw new AppError('User context required for update', 400, AppError.CODES.BAD_REQUEST);
    }

    const columns = Object.keys(data);
    const values = Object.values(data);
    const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');

    const sql = `
      UPDATE ${table}
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${values.length + 1} AND user_id = $${values.length + 2}
      RETURNING *
    `;

    const params = [...values, id, userId];

    try {
      const result = await pool.query(sql, params);
      if (result.rows.length === 0) {
        throw new AppError(`${table} not found`, 404, AppError.CODES.NOT_FOUND);
      }
      return result.rows[0];
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      this.logger?.error('Update failed', error, { table, id });
      throw new AppError(
        `Failed to update ${table}`,
        500,
        AppError.CODES.DATABASE_ERROR,
        { originalError: error.message }
      );
    }
  }

  async delete(table, id, context = {}) {
    const pool = context.pool || this.pool;
    const userId = context.userId;

    if (!userId) {
      throw new AppError('User context required for delete', 400, AppError.CODES.BAD_REQUEST);
    }

    const sql = `
      DELETE FROM ${table}
      WHERE id = $1 AND user_id = $2
      RETURNING id
    `;

    try {
      const result = await pool.query(sql, [id, userId]);
      if (result.rows.length === 0) {
        throw new AppError(`${table} not found`, 404, AppError.CODES.NOT_FOUND);
      }
      return { id: result.rows[0].id };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      this.logger?.error('Delete failed', error, { table, id });
      throw new AppError(
        `Failed to delete from ${table}`,
        500,
        AppError.CODES.DATABASE_ERROR,
        { originalError: error.message }
      );
    }
  }
}

module.exports = PostgreSQLAdapter;

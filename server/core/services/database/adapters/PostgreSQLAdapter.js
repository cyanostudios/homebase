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
   * Find first occurrence of `search` at parenthesis depth 0.
   * Ignores matches inside subqueries / LATERAL / function args (e.g. ARRAY_AGG(... ORDER BY ...)).
   */
  _findTopLevelIndex(sql, search) {
    const upper = sql.toUpperCase();
    const needle = search.toUpperCase();
    let depth = 0;

    for (let i = 0; i <= upper.length - needle.length; i++) {
      const ch = upper[i];
      if (ch === '(') {
        depth += 1;
        continue;
      }
      if (ch === ')') {
        depth = Math.max(0, depth - 1);
        continue;
      }
      if (depth === 0 && upper.startsWith(needle, i)) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Find first top-level match of `regex` (must be anchored with ^).
   * Used for trailing clauses where whitespace may be newlines (ORDER BY\n ...).
   */
  _findTopLevelRegexIndex(sql, regex) {
    let depth = 0;

    for (let i = 0; i < sql.length; i++) {
      const ch = sql[i];
      if (ch === '(') {
        depth += 1;
        continue;
      }
      if (ch === ')') {
        depth = Math.max(0, depth - 1);
        continue;
      }
      if (depth !== 0) continue;

      const match = sql.slice(i).match(regex);
      if (match && match.index === 0) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Earliest top-level trailing clause (ORDER BY / GROUP BY / LIMIT / OFFSET).
   * Accepts any whitespace around keywords so multiline ORDER BY / LIMIT still work.
   */
  _findTopLevelTrailingClauseIndex(sql) {
    const positions = [
      this._findTopLevelRegexIndex(sql, /^\s+ORDER\s+BY\b/i),
      this._findTopLevelRegexIndex(sql, /^\s+GROUP\s+BY\b/i),
      this._findTopLevelRegexIndex(sql, /^\s+LIMIT\b/i),
      this._findTopLevelRegexIndex(sql, /^\s+OFFSET\b/i),
    ].filter((p) => p !== -1);
    return positions.length > 0 ? Math.min(...positions) : -1;
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

    // Skip if already has user_id filter (case-insensitive word match)
    const userIdPattern = /\buser_id\b/i;
    if (userIdPattern.test(sql)) {
      return sql;
    }

    // For SELECT queries, add WHERE clause
    if (upperSql.startsWith('SELECT')) {
      const trailingIndex = this._findTopLevelTrailingClauseIndex(sql);
      const whereIndex = this._findTopLevelIndex(sql, ' WHERE ');

      if (whereIndex === -1) {
        // No top-level WHERE clause
        if (trailingIndex === -1) {
          return `${sql} WHERE user_id = $${this._getParamCount(sql) + 1}`;
        }
        const beforeClause = sql.substring(0, trailingIndex);
        const afterClause = sql.substring(trailingIndex);
        return `${beforeClause} WHERE user_id = $${this._getParamCount(sql) + 1} ${afterClause}`;
      }

      // Has top-level WHERE — append AND before trailing clauses (or at end)
      const paramNum = this._getParamCount(sql) + 1;
      if (trailingIndex === -1) {
        return `${sql} AND user_id = $${paramNum}`;
      }
      const beforeClause = sql.substring(0, trailingIndex).trim();
      const afterClause = sql.substring(trailingIndex);
      return `${beforeClause} AND user_id = $${paramNum} ${afterClause}`;
    }

    // For UPDATE/DELETE, add WHERE clause if not present
    if (upperSql.startsWith('UPDATE') || upperSql.startsWith('DELETE')) {
      const whereIndex = this._findTopLevelIndex(sql, ' WHERE ');
      if (whereIndex === -1) {
        return `${sql} WHERE user_id = $${this._getParamCount(sql) + 1}`;
      }

      // Has WHERE — insert AND before top-level RETURNING when present
      const returningIndex = this._findTopLevelIndex(sql, ' RETURNING');
      const returningBare =
        returningIndex === -1 ? this._findTopLevelIndex(sql, 'RETURNING') : returningIndex;
      if (returningBare !== -1) {
        const beforeReturning = sql.substring(0, returningBare).trim();
        const returningClause = sql.substring(returningBare);
        const paramNum = this._getParamCount(sql) + 1;
        return `${beforeReturning} AND user_id = $${paramNum} ${returningClause}`;
      }
      return `${sql} AND user_id = $${this._getParamCount(sql) + 1}`;
    }

    return sql;
  }

  /**
   * Count parameter placeholders in SQL
   */
  _getParamCount(sql) {
    const matches = sql.match(/\$(\d+)/g);
    if (!matches) return 0;
    return Math.max(...matches.map((m) => Number.parseInt(m.slice(1), 10)));
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
        AppError.CODES.BAD_REQUEST,
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

      this.logger?.debug('Executing SQL query', {
        sql: finalSql,
        userId: userId,
        paramCount: finalParams.length,
      });

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
      });
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

    // Log SQL query details for debugging
    this.logger?.info('Executing INSERT query', {
      sql: sql.trim(),
      params: params,
      userId: userId,
      table: table,
      columnCount: columns.length,
      paramCount: params.length,
      dataKeys: columns,
      dataValues: values.map((v, i) => {
        // Limit value size for logging (avoid huge JSON strings)
        const val = v;
        if (typeof val === 'string' && val.length > 100) {
          return val.substring(0, 100) + '... (truncated)';
        }
        return val;
      }),
    });

    try {
      const startTime = Date.now();
      const result = await pool.query(sql, params);
      const duration = Date.now() - startTime;

      this.logger?.info('INSERT query completed', {
        duration,
        table,
        rowCount: result.rows?.length || 0,
        insertedId: result.rows?.[0]?.id,
      });

      return result.rows[0];
    } catch (error) {
      // Enhanced error logging with full SQL and params
      this.logger?.error('INSERT failed - DETAILED ERROR', error, {
        table,
        sql: sql.trim(),
        paramSummary: {
          count: params?.length ?? 0,
          types: Array.isArray(params) ? params.map((p) => typeof p) : [],
        },
        userId: userId,
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
      throw new AppError(`Failed to update ${table}`, 500, AppError.CODES.DATABASE_ERROR, {
        originalError: error.message,
        errorCode: error.code,
        errorDetail: error.detail,
        errorHint: error.hint,
      });
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
      throw new AppError(`Failed to delete from ${table}`, 500, AppError.CODES.DATABASE_ERROR, {
        originalError: error.message,
      });
    }
  }
}

module.exports = PostgreSQLAdapter;

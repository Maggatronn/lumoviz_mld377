/**
 * Database Service Layer
 * 
 * Provides a unified interface for database operations
 * Currently using PostgreSQL, but can be swapped for other databases
 * 
 * This maintains BigQuery-like interface for backward compatibility
 */

const pool = require('./db');

class DatabaseService {
  constructor() {
    this.pool = pool;
  }

  /**
   * Execute a query with BigQuery-like interface
   * Maintains backward compatibility with existing code
   * 
   * @param {Object|String} options - Query options or query string
   * @returns {Array} - Returns [rows] in BigQuery format for compatibility
   */
  async query(options) {
    let query, params = [];

    // Handle different input formats
    if (typeof options === 'string') {
      // Simple string query: query('SELECT * FROM users')
      query = options;
    } else if (options.query) {
      // Object with query property: { query: '...', params: {...} }
      query = options.query;
      
      if (options.params) {
        // Convert params object to array for PostgreSQL
        // BigQuery uses named params (@param), PostgreSQL uses positional ($1, $2)
        params = this._convertParams(options.params, query);
        query = this._convertParamSyntax(query);
      }
    }

    // Auto-convert BigQuery table references to PostgreSQL
    query = this._convertTableReferences(query);
    
    // Convert SQL syntax differences
    query = this._convertSQLSyntax(query);

    try {
      const result = await this.pool.query(query, params);
      
      // Return in BigQuery format: [rows]
      // This maintains backward compatibility
      return [result.rows];
      
    } catch (error) {
      console.error('Database query error:', error.message);
      console.error('Query:', query);
      console.error('Params:', params);
      throw error;
    }
  }

  /**
   * Convert BigQuery named parameters to PostgreSQL positional parameters
   * @private
   */
  _convertParams(paramsObj, query) {
    // Extract parameter names in the order they appear in the query
    const paramNames = [];
    const paramRegex = /@(\w+)/g;
    let match;
    
    while ((match = paramRegex.exec(query)) !== null) {
      if (!paramNames.includes(match[1])) {
        paramNames.push(match[1]);
      }
    }
    
    // Build array of values in correct order
    return paramNames.map(name => paramsObj[name]);
  }

  /**
   * Convert @param syntax to $1, $2, etc.
   * @private
   */
  _convertParamSyntax(query) {
    const paramMap = new Map();
    let paramIndex = 1;
    
    return query.replace(/@(\w+)/g, (match, paramName) => {
      if (!paramMap.has(paramName)) {
        paramMap.set(paramName, paramIndex++);
      }
      return `$${paramMap.get(paramName)}`;
    });
  }

  /**
   * Convert BigQuery table references to PostgreSQL
   * Removes backticks and project.dataset prefix
   * @private
   */
  _convertTableReferences(query) {
    // Remove backticks and project.dataset prefix
    // Pattern: `project-id.dataset.table_name` -> table_name
    return query
      .replace(/`[^.`]+\.[^.`]+\.([^`]+)`/g, '$1')  // `project.dataset.table` -> table
      .replace(/`([^`]+)`/g, '$1')  // Remove any remaining backticks
      // Handle non-backticked project.dataset.INFORMATION_SCHEMA references
      .replace(/[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.(INFORMATION_SCHEMA\.[A-Z_]+)/g, '$1');
  }

  /**
   * Convert BigQuery SQL syntax to PostgreSQL
   * @private
   */
  _convertSQLSyntax(query) {
    // Order matters! Process FORMAT_DATE before DATE_TRUNC to avoid regex conflicts
    return query
      // CAST(x AS STRING) -> CAST(x AS TEXT)
      .replace(/CAST\s*\(\s*([^)]+)\s+AS\s+STRING\s*\)/gi, 'CAST($1 AS TEXT)')
      // ARRAY_LENGTH(array) -> COALESCE(array_length(array, 1), 0)
      .replace(/ARRAY_LENGTH\s*\(\s*([^)]+)\s*\)/gi, 'COALESCE(array_length($1, 1), 0)')
      // FORMAT_DATE("%b %d", date) -> TO_CHAR(date, 'Mon DD') - MUST come before DATE_TRUNC
      .replace(/FORMAT_DATE\s*\(\s*['""]%b %d['""],\s*DATE_TRUNC\s*\(([^,]+),\s*WEEK\s*\)\s*\)/gi, "TO_CHAR(DATE_TRUNC('week', $1), 'Mon DD')")
      .replace(/FORMAT_DATE\s*\(\s*['""]%b %d['""],\s*DATE_TRUNC\s*\(([^,]+),\s*DAY\s*\)\s*\)/gi, "TO_CHAR(DATE_TRUNC('day', $1), 'Mon DD')")
      .replace(/FORMAT_DATE\s*\(\s*['""]%b %Y['""],\s*DATE_TRUNC\s*\(([^,]+),\s*MONTH\s*\)\s*\)/gi, "TO_CHAR(DATE_TRUNC('month', $1), 'Mon YYYY')")
      .replace(/FORMAT_DATE\s*\(\s*['""]%b %d['""],\s*([^)]+)\)/gi, "TO_CHAR($1, 'Mon DD')")
      .replace(/FORMAT_DATE\s*\(\s*['""]%b %Y['""],\s*([^)]+)\)/gi, "TO_CHAR($1, 'Mon YYYY')")
      // DATE_TRUNC(date, MONTH) -> DATE_TRUNC('month', date)
      .replace(/DATE_TRUNC\s*\(\s*([^,]+),\s*MONTH\s*\)/gi, "DATE_TRUNC('month', $1)")
      .replace(/DATE_TRUNC\s*\(\s*([^,]+),\s*WEEK\s*\)/gi, "DATE_TRUNC('week', $1)")
      .replace(/DATE_TRUNC\s*\(\s*([^,]+),\s*DAY\s*\)/gi, "DATE_TRUNC('day', $1)")
      // CURRENT_TIMESTAMP() -> CURRENT_TIMESTAMP
      .replace(/CURRENT_TIMESTAMP\(\)/g, 'CURRENT_TIMESTAMP')
      // DATE(field) -> field::date
      .replace(/\bDATE\(([^)]+)\)/g, '($1)::date')
      // IN UNNEST(@array) or IN UNNEST($1) -> = ANY(@array) or = ANY($1)
      // Handle both @param (before conversion) and $N (after conversion)
      .replace(/CAST\s*\(\s*([^)]+)\s+AS\s+TEXT\s*\)\s+IN\s+UNNEST\s*\(\s*(@\w+|\$\d+)\s*\)/gi, 'CAST($1 AS TEXT) = ANY($2)')
      .replace(/(\w+(?:\.\w+)?)\s+IN\s+UNNEST\s*\(\s*(@\w+|\$\d+)\s*\)/gi, '$1 = ANY($2)');
  }

  /**
   * Execute a raw PostgreSQL query
   * Use this for PostgreSQL-specific features
   */
  async rawQuery(query, params = []) {
    const result = await this.pool.query(query, params);
    return result.rows;
  }

  /**
   * Get a client from the pool for transactions
   */
  async getClient() {
    return await this.pool.connect();
  }

  /**
   * Execute queries in a transaction
   */
  async transaction(callback) {
    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

// Export singleton instance
const database = new DatabaseService();
module.exports = database;

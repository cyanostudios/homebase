class ImportModel {
    constructor(pool) {
      this.pool = pool;
    }
    // Log import operations for audit trail
    static async logImportOperation(userId, operation) {
      const query = `
        INSERT INTO import_logs (user_id, operation_type, data, status, created_at)
        VALUES (?, ?, ?, ?, NOW())
      `;
      
      try {
        const [result] = await this.pool.query(query, [
          userId,
          operation.type,
          JSON.stringify(operation.data),
          operation.status
        ]);
        return result.insertId;
      } catch (error) {
        console.error('Error logging import operation:', error);
        throw error;
      }
    }
  
    // Get import history for user
    static async getImportHistory(userId) {
      const query = `
        SELECT id, operation_type, data, status, created_at
        FROM import_logs 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT 50
      `;
      
      try {
        const [rows] = await this.pool.query(query, [userId]);
        return rows.map(row => ({
          ...row,
          data: JSON.parse(row.data)
        }));
      } catch (error) {
        console.error('Error getting import history:', error);
        throw error;
      }
    }
  
    // Create import_logs table if not exists (migration helper)
    async ensureImportLogsTable() {
      const query = `
        CREATE TABLE IF NOT EXISTS import_logs (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          operation_type VARCHAR(50) NOT NULL,
          data JSONB,
          status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'error')),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_import_logs_user_id ON import_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_import_logs_created_at ON import_logs(created_at);
      `;
      
      try {
        await this.pool.query(query);
        console.log('✅ Import logs table ready');
      } catch (error) {
        console.error('Error creating import_logs table:', error);
        throw error;
      }
    }
  
    // Validate CSV structure against plugin schema
    validateCsvStructure(csvData, pluginType) {
      const validationRules = {
        contacts: {
          required: ['name'],
          optional: ['email', 'phone', 'company', 'notes'],
          transform: (row) => ({
            name: row.name?.trim(),
            email: row.email?.trim().toLowerCase(),
            phone: row.phone?.trim(),
            company: row.company?.trim(),
            notes: row.notes?.trim()
          })
        }
        // Add more plugin types as needed
      };
  
      const rules = validationRules[pluginType];
      if (!rules) {
        throw new Error(`Unsupported plugin type: ${pluginType}`);
      }
  
      const errors = [];
      const validatedData = [];
  
      csvData.forEach((row, index) => {
        const rowErrors = [];
        
        // Check required fields
        rules.required.forEach(field => {
          if (!row[field] || !row[field].toString().trim()) {
            rowErrors.push(`Row ${index + 1}: Missing required field '${field}'`);
          }
        });
  
        // Transform and clean data
        const transformedRow = rules.transform(row);
        
        if (rowErrors.length === 0) {
          validatedData.push(transformedRow);
        } else {
          errors.push(...rowErrors);
        }
      });
  
      return {
        isValid: errors.length === 0,
        errors,
        validatedData
      };
    }
  }
  
  module.exports = ImportModel;
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
          required: ['companyName', 'contactType', 'email'],
          optional: ['phone', 'organizationNumber', 'personalNumber', 'website', 'notes', 'phone2', 'companyType', 'vatNumber', 'taxRate', 'paymentTerms', 'currency', 'fTax'],
          transform: (row) => ({
            companyName: row.companyName?.trim(),
            contactType: row.contactType?.trim().toLowerCase(),
            email: row.email?.trim().toLowerCase(),
            phone: row.phone?.trim() || '',
            phone2: row.phone2?.trim() || '',
            organizationNumber: row.organizationNumber?.trim() || '',
            personalNumber: row.personalNumber?.trim() || '',
            website: row.website?.trim() || '',
            notes: row.notes?.trim() || '',
            companyType: row.companyType?.trim() || '',
            vatNumber: row.vatNumber?.trim() || '',
            taxRate: row.taxRate?.trim() || '',
            paymentTerms: row.paymentTerms?.trim() || '',
            currency: row.currency?.trim() || 'SEK',
            fTax: row.fTax?.trim() || '',
            // These will be auto-generated
            contactPersons: [],
            addresses: []
          }),
          validate: (transformedRow) => {
            const errors = [];
            
            // Validate contactType
            if (!['company', 'private'].includes(transformedRow.contactType)) {
              errors.push('contactType must be "company" or "private"');
            }
            
            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(transformedRow.email)) {
              errors.push('Invalid email format');
            }
            
            // Validate organization number for companies
            if (transformedRow.contactType === 'company' && transformedRow.organizationNumber) {
              const orgRegex = /^\d{6}-\d{4}$/;
              if (!orgRegex.test(transformedRow.organizationNumber)) {
                errors.push('Organization number must be format: 123456-7890');
              }
            }
            
            // Validate personal number for private persons
            if (transformedRow.contactType === 'private' && transformedRow.personalNumber) {
              const personalRegex = /^\d{8}-\d{4}$/;
              if (!personalRegex.test(transformedRow.personalNumber)) {
                errors.push('Personal number must be format: 19801201-1234');
              }
            }
            
            return errors;
          }
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
        
        // Validate transformed data if validation function exists
        if (rules.validate) {
          const validationErrors = rules.validate(transformedRow);
          validationErrors.forEach(error => {
            rowErrors.push(`Row ${index + 1}: ${error}`);
          });
        }
        
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
const ImportModel = require('./model');
const ContactsModel = require('../contacts/model');
const multer = require('multer');
const csvParser = require('csv-parser');
const { Readable } = require('stream');

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

class ImportController {
  // Parse CSV data from buffer
  static parseCsvData(buffer) {
    return new Promise((resolve, reject) => {
      const results = [];
      const readable = new Readable();
      readable.push(buffer);
      readable.push(null);

      readable
        .pipe(csvParser({
          skipEmptyLines: true,
          headers: true
        }))
        .on('data', (data) => {
          // Clean up headers (remove BOM, trim spaces)
          const cleanData = {};
          Object.keys(data).forEach(key => {
            const cleanKey = key.replace(/^\ufeff/, '').trim().toLowerCase();
            cleanData[cleanKey] = data[key];
          });
          results.push(cleanData);
        })
        .on('end', () => resolve(results))
        .on('error', reject);
    });
  }

  // Preview import data before actual import
  static async previewImport(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No CSV file uploaded' });
      }

      const { pluginType = 'contacts' } = req.body;
      const csvData = await ImportController.parseCsvData(req.file.buffer);
      
      if (csvData.length === 0) {
        return res.status(400).json({ error: 'CSV file is empty' });
      }

      // Validate structure
      const validation = ImportModel.validateCsvStructure(csvData, pluginType);
      
      // Return preview data (first 5 rows + validation results)
      res.json({
        preview: csvData.slice(0, 5),
        totalRows: csvData.length,
        validation: {
          isValid: validation.isValid,
          errors: validation.errors,
          validRowCount: validation.validatedData.length
        },
        headers: Object.keys(csvData[0] || {}),
        pluginType
      });

    } catch (error) {
      console.error('Error previewing import:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Import CSV data to specific plugin
  static async importCsv(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No CSV file uploaded' });
      }

      const { pluginType = 'contacts', skipValidation = false } = req.body;
      const userId = req.session.user.id;
      
      // Log import start
      const logId = await ImportModel.logImportOperation(userId, {
        type: 'csv_import',
        data: {
          fileName: req.file.originalname,
          pluginType,
          fileSize: req.file.size
        },
        status: 'pending'
      });

      try {
        const csvData = await ImportController.parseCsvData(req.file.buffer);
        
        if (csvData.length === 0) {
          throw new Error('CSV file is empty');
        }

        // Validate data structure
        const validation = ImportModel.validateCsvStructure(csvData, pluginType);
        
        if (!validation.isValid && !skipValidation) {
          throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }

        // Import data based on plugin type
        let importResults;
        switch (pluginType) {
          case 'contacts':
            importResults = await ImportController.importContacts(
              validation.validatedData, 
              userId
            );
            break;
          default:
            throw new Error(`Unsupported plugin type: ${pluginType}`);
        }

        // Update log with success
        await ImportModel.logImportOperation(userId, {
          type: 'csv_import_complete',
          data: {
            ...importResults,
            fileName: req.file.originalname
          },
          status: 'success'
        });

        res.json({
          success: true,
          ...importResults,
          validation: validation.isValid ? null : {
            errors: validation.errors,
            validRowCount: validation.validatedData.length
          }
        });

      } catch (error) {
        // Update log with error
        await ImportModel.logImportOperation(userId, {
          type: 'csv_import_error',
          data: {
            fileName: req.file.originalname,
            error: error.message
          },
          status: 'error'
        });
        throw error;
      }

    } catch (error) {
      console.error('Error importing CSV:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Import contacts specifically
  static async importContacts(contactsData, userId) {
    let created = 0;
    let updated = 0;
    let errors = [];

    for (const contactData of contactsData) {
      try {
        // Check if contact exists by email
        const existingContact = await ContactsModel.findByEmail(contactData.email, userId);

        if (existingContact) {
          // Update existing contact
          await ContactsModel.updateContact(userId, existingContact.id, {
            ...contactData,
            updatedAt: new Date()
          });
          updated++;
        } else {
          // Create new contact
          await ContactsModel.createContact(userId, {
            ...contactData,
            createdAt: new Date(),
            updatedAt: new Date()
          });
          created++;
        }
      } catch (error) {
        errors.push({
          data: contactData,
          error: error.message
        });
      }
    }

    return {
      totalProcessed: contactsData.length,
      created,
      updated,
      errors: errors.length > 0 ? errors : null
    };
  }

  // Get available import templates
  static async getImportTemplates(req, res) {
    try {
      const templates = {
        contacts: {
          name: 'Contacts Import',
          description: 'Import business contacts with company or private person information',
          requiredFields: ['companyName', 'contactType', 'email'],
          optionalFields: ['phone', 'organizationNumber', 'personalNumber', 'website', 'notes', 'phone2', 'companyType', 'vatNumber', 'taxRate', 'paymentTerms', 'currency', 'fTax'],
          sampleData: [
            {
              companyName: 'Acme Corporation',
              contactType: 'company',
              email: 'info@acme.com',
              phone: '08-123 45 67',
              organizationNumber: '556677-8899',
              website: 'www.acme.com',
              notes: 'Important client'
            },
            {
              companyName: 'John Doe',
              contactType: 'private',
              email: 'john@example.com', 
              phone: '070-123 45 67',
              personalNumber: '19801201-1234',
              notes: 'Consultant'
            }
          ]
        }
      };

      res.json(templates);
    } catch (error) {
      console.error('Error getting import templates:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Validate import data without importing
  static async validateImportData(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No CSV file uploaded' });
      }

      const { pluginType = 'contacts' } = req.body;
      const csvData = await ImportController.parseCsvData(req.file.buffer);
      
      const validation = ImportModel.validateCsvStructure(csvData, pluginType);
      
      res.json({
        isValid: validation.isValid,
        errors: validation.errors,
        validRowCount: validation.validatedData.length,
        totalRows: csvData.length,
        pluginType
      });

    } catch (error) {
      console.error('Error validating import data:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

// Add upload middleware to controller for easy access
ImportController.uploadMiddleware = upload.single('csvFile');

module.exports = ImportController;
// scripts/setup-database-mysql.js
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

// Database connection
const dbConfig = {
  host: 'localhost',
  user: 's122463_homebase_prod',
  password: 'kqACsuVeAd9FVfneZV2G',
  database: 's122463_homebase_prod'
};

async function setupDatabase() {
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    console.log('🗄️  Setting up Homebase MySQL database tables...');
    console.log('📍 Database: s122463_homebase_prod');
    
    // Users table for auth
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    // Plugin access control
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS user_plugin_access (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        plugin_name VARCHAR(100) NOT NULL,
        enabled BOOLEAN DEFAULT true,
        granted_by INT,
        granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_plugin (user_id, plugin_name),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (granted_by) REFERENCES users(id)
      )
    `);
    
    // Contacts table - matches AppContext Contact interface exactly
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS contacts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        contact_number VARCHAR(50) NOT NULL,
        contact_type VARCHAR(20) DEFAULT 'company',
        company_name VARCHAR(255) NOT NULL,
        company_type VARCHAR(50),
        organization_number VARCHAR(50),
        vat_number VARCHAR(50),
        personal_number VARCHAR(50),
        contact_persons JSON,
        addresses JSON,
        email VARCHAR(255),
        phone VARCHAR(50),
        phone2 VARCHAR(50),
        website VARCHAR(255),
        tax_rate VARCHAR(10),
        payment_terms VARCHAR(50),
        currency VARCHAR(10),
        f_tax VARCHAR(10),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CHECK (contact_type IN ('company', 'private'))
      )
    `);
    
    // Notes table - matches AppContext Note interface exactly
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS notes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        content TEXT,
        mentions JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    
    // Sessions table for express-session
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
        expires INT(11) UNSIGNED NOT NULL,
        data MEDIUMTEXT COLLATE utf8mb4_bin,
        PRIMARY KEY (session_id)
      )
    `);
    
    // Create indexes for performance
    await connection.execute('CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id)');
    await connection.execute('CREATE INDEX IF NOT EXISTS idx_contacts_number ON contacts(contact_number)');
    await connection.execute('CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id)');
    await connection.execute('CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires)');
    await connection.execute('CREATE INDEX IF NOT EXISTS idx_plugin_access_user ON user_plugin_access(user_id, plugin_name)');
    
    // Create default superuser
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const [result] = await connection.execute(`
      INSERT INTO users (email, password_hash, role) 
      VALUES (?, ?, 'superuser')
      ON DUPLICATE KEY UPDATE 
        password_hash = VALUES(password_hash),
        role = VALUES(role)
    `, ['admin@homebase.se', hashedPassword]);
    
    // Get the user ID
    const [userRows] = await connection.execute('SELECT id FROM users WHERE email = ?', ['admin@homebase.se']);
    const superuserId = userRows[0].id;
    
    // Grant all plugin access to superuser
    const plugins = ['contacts', 'notes'];
    for (const plugin of plugins) {
      await connection.execute(`
        INSERT INTO user_plugin_access (user_id, plugin_name, granted_by)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE granted_by = VALUES(granted_by)
      `, [superuserId, plugin, superuserId]);
    }
    
    console.log('✅ Database setup complete!');
    console.log('✅ Default superuser created: admin@homebase.se / admin123');
    console.log('⚠️  CHANGE DEFAULT PASSWORD AFTER FIRST LOGIN!');
    console.log('✅ Plugin access granted: contacts, notes');
    
    return superuserId;
    
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

// Migrate AppContext mock data to database
async function migrateMockData(userId) {
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    console.log('📦 Migrating AppContext mock data to database...');
    
    // Migrate Acme Corporation
    const [acmeResult] = await connection.execute(`
      INSERT INTO contacts (
        user_id, contact_number, contact_type, company_name, company_type,
        organization_number, vat_number, contact_persons, addresses,
        email, phone, phone2, website, tax_rate, payment_terms, currency, f_tax, notes,
        created_at, updated_at
      ) VALUES (
        ?, '01', 'company', 'Acme Corporation', 'AB',
        '556123-4567', 'SE556123456701', 
        ?, ?,
        'info@acme.com', '+46 8 123 456 78', '+46 70 123 45 67', 'https://acme.se',
        '25', '30', 'SEK', 'yes', 'Important client with multiple projects',
        '2024-01-01 00:00:00', '2024-01-01 00:00:00'
      )
    `, [
      userId,
      JSON.stringify([{
        id: '1',
        name: 'John Smith',
        title: 'CEO',
        email: 'john@acme.com',
        phone: '+46 70 123 45 67'
      }]),
      JSON.stringify([{
        id: '1',
        type: 'Main Office',
        addressLine1: 'Storgatan 123',
        addressLine2: '',
        postalCode: '111 22',
        city: 'Stockholm',
        region: 'Stockholm',
        country: 'Sweden'
      }])
    ]);
    
    const acmeId = acmeResult.insertId;
    
    // Migrate Jane Cooper
    const [janeResult] = await connection.execute(`
      INSERT INTO contacts (
        user_id, contact_number, contact_type, company_name, personal_number,
        addresses, email, phone, tax_rate, payment_terms, currency, f_tax,
        created_at, updated_at
      ) VALUES (
        ?, '02', 'private', 'Jane Cooper', '19851201-1234',
        ?, 'jane.cooper@example.com', '+46 70 987 65 43', '25', '30', 'SEK', 'no',
        '2024-01-02 00:00:00', '2024-01-02 00:00:00'
      )
    `, [
      userId,
      JSON.stringify([{
        id: '1',
        type: 'Home Address',
        addressLine1: 'Hemgatan 45',
        addressLine2: 'Lägenhet 3B',
        postalCode: '211 34',
        city: 'Malmö',
        region: 'Skåne',
        country: 'Sweden'
      }])
    ]);
    
    const janeId = janeResult.insertId;
    
    // Migrate Project Meeting Notes with Acme mention
    await connection.execute(`
      INSERT INTO notes (
        user_id, title, content, mentions, created_at, updated_at
      ) VALUES (
        ?, 'Project Meeting Notes',
        'Discussed the new project requirements with the team. Key points:

- Budget: $50,000
- Timeline: 3 months
- Team size: 4 developers
- Technology stack: React, Node.js, PostgreSQL

Next steps:
1. Create detailed project plan
2. Set up development environment
3. Schedule weekly standup meetings

We should reach out to @Acme Corporation for additional requirements.',
        ?,
        '2024-01-01 00:00:00', '2024-01-02 00:00:00'
      )
    `, [
      userId,
      JSON.stringify([{
        contactId: acmeId.toString(),
        contactName: 'Acme Corporation',
        companyName: 'Acme Corporation',
        position: 298,
        length: 16
      }])
    ]);
    
    // Migrate Marketing Campaign Ideas with Jane mention
    await connection.execute(`
      INSERT INTO notes (
        user_id, title, content, mentions, created_at, updated_at
      ) VALUES (
        ?, 'Ideas for Marketing Campaign',
        'Brainstorming session for Q2 marketing campaign:

- Social media focus on LinkedIn and Twitter
- Content marketing with weekly blog posts
- Webinar series on industry trends
- Partnership with tech influencers

Budget allocation:
- Social media ads: 40%
- Content creation: 30%
- Webinars: 20%
- Influencer partnerships: 10%

Note: @Jane Cooper mentioned she has contacts in the industry that could help with influencer partnerships.',
        ?,
        '2024-01-03 00:00:00', '2024-01-03 00:00:00'
      )
    `, [
      userId,
      JSON.stringify([{
        contactId: janeId.toString(),
        contactName: 'Jane Cooper',
        position: 392,
        length: 12
      }])
    ]);
    
    console.log('✅ Mock data migrated successfully!');
    console.log('📊 Data available: 2 contacts, 2 notes with @mentions');
    console.log(`📌 Contact IDs: Acme=${acmeId}, Jane=${janeId}`);
    
  } catch (error) {
    console.error('❌ Mock data migration failed:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

// Main function
async function main() {
  try {
    const userId = await setupDatabase();
    await migrateMockData(userId);
    console.log('🚀 Homebase database ready!');
    console.log('🔗 All cross-plugin @mentions preserved');
  } catch (error) {
    console.error('Setup failed:', error);
    process.exit(1);
  } finally {
    // Connection already closed in functions
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { setupDatabase, migrateMockData };

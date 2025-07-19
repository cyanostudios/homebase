// scripts/setup-database.js
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: '.env.local' });

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function setupDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('🗄️  Setting up Homebase database tables...');
    console.log('📍 Database:', process.env.DATABASE_URL);
    
    // Users table for auth
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Plugin access control
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_plugin_access (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        plugin_name VARCHAR(100) NOT NULL,
        enabled BOOLEAN DEFAULT true,
        granted_by INTEGER REFERENCES users(id),
        granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, plugin_name)
      )
    `);
    
    // Contacts table - matches AppContext Contact interface exactly
    await client.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        contact_number VARCHAR(50) NOT NULL,
        contact_type VARCHAR(20) DEFAULT 'company' CHECK (contact_type IN ('company', 'private')),
        company_name VARCHAR(255) NOT NULL,
        company_type VARCHAR(50),
        organization_number VARCHAR(50),
        vat_number VARCHAR(50),
        personal_number VARCHAR(50),
        contact_persons JSONB DEFAULT '[]'::jsonb,
        addresses JSONB DEFAULT '[]'::jsonb,
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
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Notes table - matches AppContext Note interface exactly
    await client.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        content TEXT,
        mentions JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Estimates table
    await client.query(`
      CREATE TABLE IF NOT EXISTS estimates (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        estimate_number VARCHAR(20) UNIQUE NOT NULL,
        contact_id INTEGER,
        contact_name VARCHAR(255),
        organization_number VARCHAR(50),
        currency VARCHAR(3) DEFAULT 'SEK',
        line_items JSONB DEFAULT '[]'::jsonb,
        notes TEXT,
        valid_to DATE,
        subtotal DECIMAL(10,2) DEFAULT 0,
        total_vat DECIMAL(10,2) DEFAULT 0,
        total DECIMAL(10,2) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'draft',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Sessions table for express-session
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        sid VARCHAR PRIMARY KEY,
        sess JSONB NOT NULL,
        expire TIMESTAMP(6) NOT NULL
      )
    `);
    
    // Create indexes for performance
    await client.query('CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_contacts_number ON contacts(contact_number)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_estimates_user_id ON estimates(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_estimates_number ON estimates(estimate_number)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_estimates_contact_id ON estimates(contact_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_estimates_status ON estimates(status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions(expire)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_plugin_access_user ON user_plugin_access(user_id, plugin_name)');
    
    // Create default superuser
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const result = await client.query(`
      INSERT INTO users (email, password_hash, role) 
      VALUES ('admin@homebase.se', $1, 'superuser')
      ON CONFLICT (email) DO UPDATE SET 
        password_hash = EXCLUDED.password_hash,
        role = EXCLUDED.role
      RETURNING id
    `, [hashedPassword]);
    
    const superuserId = result.rows[0].id;
    
    // Grant all plugin access to superuser
    const plugins = ['contacts', 'notes', 'estimates'];
    for (const plugin of plugins) {
      await client.query(`
        INSERT INTO user_plugin_access (user_id, plugin_name, granted_by)
        VALUES ($1, $2, $1)
        ON CONFLICT (user_id, plugin_name) DO NOTHING
      `, [superuserId, plugin]);
    }
    
    console.log('✅ Database setup complete!');
    console.log('✅ Default superuser created: admin@homebase.se / admin123');
    console.log('⚠️  CHANGE DEFAULT PASSWORD AFTER FIRST LOGIN!');
    console.log('✅ Plugin access granted: contacts, notes, estimates');
    
    return superuserId;
    
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Migrate AppContext mock data to database
async function migrateMockData(userId) {
  const client = await pool.connect();
  
  try {
    console.log('📦 Migrating AppContext mock data to database...');
    
    // Migrate Acme Corporation
    const acmeResult = await client.query(`
      INSERT INTO contacts (
        user_id, contact_number, contact_type, company_name, company_type,
        organization_number, vat_number, contact_persons, addresses,
        email, phone, phone2, website, tax_rate, payment_terms, currency, f_tax, notes,
        created_at, updated_at
      ) VALUES (
        $1, '01', 'company', 'Acme Corporation', 'AB',
        '556123-4567', 'SE556123456701', 
        $2::jsonb, $3::jsonb,
        'info@acme.com', '+46 8 123 456 78', '+46 70 123 45 67', 'https://acme.com',
        '25', '30', 'SEK', 'yes', 'Important client with multiple projects',
        '2024-01-01'::timestamp, '2024-01-01'::timestamp
      ) RETURNING id
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
    
    const acmeId = acmeResult.rows[0].id;
    
    // Migrate Jane Cooper
    const janeResult = await client.query(`
      INSERT INTO contacts (
        user_id, contact_number, contact_type, company_name, personal_number,
        addresses, email, phone, tax_rate, payment_terms, currency, f_tax,
        created_at, updated_at
      ) VALUES (
        $1, '02', 'private', 'Jane Cooper', '19851201-1234',
        $2::jsonb, 'jane.cooper@example.com', '+46 70 987 65 43', '25', '30', 'SEK', 'no',
        '2024-01-02'::timestamp, '2024-01-02'::timestamp
      ) RETURNING id
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
    
    const janeId = janeResult.rows[0].id;
    
    // Migrate Project Meeting Notes with Acme mention
    await client.query(`
      INSERT INTO notes (
        user_id, title, content, mentions, created_at, updated_at
      ) VALUES (
        $1, 'Project Meeting Notes',
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
        $2::jsonb,
        '2024-01-01'::timestamp, '2024-01-02'::timestamp
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
    await client.query(`
      INSERT INTO notes (
        user_id, title, content, mentions, created_at, updated_at
      ) VALUES (
        $1, 'Ideas for Marketing Campaign',
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
        $2::jsonb,
        '2024-01-03'::timestamp, '2024-01-03'::timestamp
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
    client.release();
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
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { setupDatabase, migrateMockData };
// scripts/add-tasks-table.js
const { Pool } = require('pg');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: '.env.local' });

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function addTasksTable() {
  const client = await pool.connect();
  
  try {
    console.log('🗄️  Adding tasks table to database...');
    
    // Create tasks table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        content TEXT,
        mentions JSONB,
        status VARCHAR(20) DEFAULT 'not started' CHECK (status IN ('not started', 'in progress', 'Done', 'Canceled')),
        priority VARCHAR(10) DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High')),
        due_date DATE,
        assigned_to INTEGER REFERENCES contacts(id),
        created_from_note INTEGER REFERENCES notes(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create indexes for performance
    await client.query('CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_tasks_created_from_note ON tasks(created_from_note)');
    
    // Grant access to tasks plugin for existing superuser
    await client.query(`
      INSERT INTO user_plugin_access (user_id, plugin_name, granted_by)
      SELECT id, 'tasks', id 
      FROM users 
      WHERE role = 'superuser'
      ON CONFLICT (user_id, plugin_name) DO NOTHING
    `);
    
    console.log('✅ Tasks table created successfully!');
    console.log('✅ Indexes created for performance');
    console.log('✅ Plugin access granted to superuser');
    
  } catch (error) {
    console.error('❌ Failed to add tasks table:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    await addTasksTable();
    console.log('🚀 Tasks table ready!');
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

module.exports = { addTasksTable };
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('=== CHECKING DATABASE STRUCTURE ===');
    
    // Check if tables exist
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('\n📋 Tables in database:');
    tablesResult.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
    // Check estimates table structure if it exists
    try {
      const estimatesStructure = await client.query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'estimates' 
        ORDER BY ordinal_position
      `);
      
      console.log('\n📊 Estimates table structure:');
      estimatesStructure.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
      });
      
      // Check estimates count
      const estimatesCount = await client.query('SELECT COUNT(*) FROM estimates');
      console.log(`\n📈 Estimates count: ${estimatesCount.rows[0].count}`);
      
    } catch (error) {
      console.log('\n❌ Estimates table does not exist or has issues');
    }
    
    // Check estimate_shares table structure if it exists
    try {
      const sharesStructure = await client.query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'estimate_shares' 
        ORDER BY ordinal_position
      `);
      
      console.log('\n📊 Estimate_shares table structure:');
      sharesStructure.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
      });
      
    } catch (error) {
      console.log('\n❌ Estimate_shares table does not exist or has issues');
    }
    
  } catch (error) {
    console.error('❌ Database check failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

checkDatabase();

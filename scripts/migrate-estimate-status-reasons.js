// scripts/migrate-estimate-status-reasons.js
const { Pool } = require('pg');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: '.env.local' });

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrateEstimateStatusReasons() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Migrating estimates table to support status reasons...');
    console.log('📍 Database:', process.env.DATABASE_URL);
    
    // Check if columns already exist
    const checkResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'estimates' 
      AND column_name IN ('acceptance_reasons', 'rejection_reasons', 'status_changed_at')
    `);
    
    const existingColumns = checkResult.rows.map(row => row.column_name);
    console.log('📋 Existing status reason columns:', existingColumns);
    
    // Add acceptance_reasons column if it doesn't exist
    if (!existingColumns.includes('acceptance_reasons')) {
      console.log('➕ Adding acceptance_reasons column...');
      await client.query(`
        ALTER TABLE estimates 
        ADD COLUMN acceptance_reasons TEXT DEFAULT '[]'
      `);
    } else {
      console.log('✅ acceptance_reasons column already exists');
    }
    
    // Add rejection_reasons column if it doesn't exist
    if (!existingColumns.includes('rejection_reasons')) {
      console.log('➕ Adding rejection_reasons column...');
      await client.query(`
        ALTER TABLE estimates 
        ADD COLUMN rejection_reasons TEXT DEFAULT '[]'
      `);
    } else {
      console.log('✅ rejection_reasons column already exists');
    }
    
    // Add status_changed_at column if it doesn't exist
    if (!existingColumns.includes('status_changed_at')) {
      console.log('➕ Adding status_changed_at column...');
      await client.query(`
        ALTER TABLE estimates 
        ADD COLUMN status_changed_at TIMESTAMP NULL
      `);
    } else {
      console.log('✅ status_changed_at column already exists');
    }
    
    // Update existing estimates to have empty arrays for reasons
    console.log('🔄 Setting default values for existing estimates...');
    const updateResult = await client.query(`
      UPDATE estimates 
      SET 
        acceptance_reasons = COALESCE(acceptance_reasons, '[]'),
        rejection_reasons = COALESCE(rejection_reasons, '[]')
      WHERE 
        acceptance_reasons IS NULL 
        OR rejection_reasons IS NULL
        OR acceptance_reasons = ''
        OR rejection_reasons = ''
    `);
    
    console.log(`✅ Updated ${updateResult.rowCount} estimates with default reason arrays`);
    
    // Create performance index for status statistics
    console.log('📊 Creating index for status statistics...');
    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_estimates_status_reasons 
        ON estimates(user_id, status, status_changed_at) 
        WHERE status IN ('accepted', 'rejected')
      `);
      console.log('✅ Status statistics index created');
    } catch (indexError) {
      console.log('⚠️  Index already exists or failed to create:', indexError.message);
    }
    
    // Verify the migration
    const verifyResult = await client.query(`
      SELECT 
        COUNT(*) as total_estimates,
        COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted_count,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count,
        COUNT(CASE WHEN acceptance_reasons IS NOT NULL THEN 1 END) as has_acceptance_reasons,
        COUNT(CASE WHEN rejection_reasons IS NOT NULL THEN 1 END) as has_rejection_reasons
      FROM estimates
    `);
    
    const stats = verifyResult.rows[0];
    console.log('📊 Migration verification:');
    console.log(`   Total estimates: ${stats.total_estimates}`);
    console.log(`   Accepted: ${stats.accepted_count}`);
    console.log(`   Rejected: ${stats.rejected_count}`);
    console.log(`   Has acceptance_reasons: ${stats.has_acceptance_reasons}`);
    console.log(`   Has rejection_reasons: ${stats.has_rejection_reasons}`);
    
    console.log('✅ Estimate status reasons migration completed successfully!');
    console.log('🎯 Ready for status reason tracking and statistics');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Main function
async function main() {
  try {
    await migrateEstimateStatusReasons();
    console.log('🚀 Migration complete - status reasons are now available!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { migrateEstimateStatusReasons };
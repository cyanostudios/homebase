// scripts/check-tenants-status.js
// Quick script to check tenant status

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkStatus() {
  const result = await pool.query(`
    SELECT 
      u.id, 
      u.email, 
      t.neon_project_id, 
      t.neon_database_name,
      CASE 
        WHEN t.neon_connection_string IS NULL THEN '❌ Missing'
        WHEN t.neon_connection_string LIKE '%needs-update%' OR t.neon_connection_string LIKE '%placeholder%' THEN '⚠️  Placeholder'
        ELSE '✅ OK'
      END as conn_status
    FROM users u 
    LEFT JOIN tenants t ON u.id = t.user_id 
    WHERE u.id IN (3, 5, 6, 12, 14, 15)
    ORDER BY u.id
  `);

  console.log('\n📊 Tenant Status:\n');
  console.log('ID  | Email                          | Project ID           | Connection');
  console.log('----|--------------------------------|---------------------|------------');
  
  result.rows.forEach(row => {
    const id = String(row.id).padEnd(3);
    const email = (row.email || 'N/A').padEnd(32);
    const projectId = (row.neon_project_id || 'N/A').substring(0, 19).padEnd(19);
    const status = row.conn_status;
    console.log(`${id} | ${email} | ${projectId} | ${status}`);
  });

  const needsUpdate = result.rows.filter(r => r.conn_status.includes('Placeholder') || r.conn_status.includes('Missing'));
  if (needsUpdate.length > 0) {
    console.log(`\n⚠️  ${needsUpdate.length} tenant(s) need connection string updates:`);
    needsUpdate.forEach(r => {
      console.log(`   - User ${r.id} (${r.email}): Get from Neon Console project ${r.neon_project_id}`);
    });
  }

  await pool.end();
}

checkStatus()
  .then(() => process.exit(0))
  .catch(err => { console.error(err); process.exit(1); });

// Quick debug script to check orders in database
require('dotenv').config();
const { Pool } = require('pg');

async function checkOrders() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    try {
        console.log('\n=== CHECKING ORDERS IN DATABASE ===\n');

        // Check all orders grouped by status and user_id
        const result = await pool.query(`
      SELECT 
        status, 
        user_id, 
        COUNT(*) as count,
        MIN(created_at) as oldest,
        MAX(created_at) as newest
      FROM orders 
      GROUP BY status, user_id 
      ORDER BY user_id, status
    `);

        console.log('Orders by status and user_id:');
        console.table(result.rows);

        // Check specifically for delivered/shipped
        const delivered = await pool.query(`
      SELECT id, user_id, status, channel_order_id, created_at
      FROM orders 
      WHERE status IN ('delivered', 'shipped')
      ORDER BY created_at DESC
      LIMIT 10
    `);

        console.log('\n=== FIRST 10 DELIVERED/SHIPPED ORDERS ===');
        console.table(delivered.rows);

        // Check what user IDs exist
        const users = await pool.query(`
      SELECT DISTINCT user_id, COUNT(*) as order_count
      FROM orders
      GROUP BY user_id
      ORDER BY user_id
    `);

        console.log('\n=== USER IDs IN ORDERS TABLE ===');
        console.table(users.rows);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

checkOrders();

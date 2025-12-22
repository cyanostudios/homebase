// TEMPORARY CLEANUP ENDPOINT - Remove after use!

module.exports = function setupCleanup(app, pool) {
  const SUPERUSER_ID = 12;
  
  app.post('/api/admin/cleanup', async (req, res) => {
    // Check authentication
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    // Check superuser
    if (req.session.user.role !== 'superuser') {
      return res.status(403).json({ error: 'Superuser only' });
    }
    
    try {
      console.log('🧹 Starting cleanup...');
      
      // Count before
      const countUsers = await pool.query('SELECT COUNT(*) FROM users WHERE id != $1', [SUPERUSER_ID]);
      const countTenants = await pool.query('SELECT COUNT(*) FROM tenants WHERE user_id != $1', [SUPERUSER_ID]);
      const countPlugins = await pool.query('SELECT COUNT(*) FROM user_plugin_access WHERE user_id != $1', [SUPERUSER_ID]);
      
      console.log('Items to delete:', {
        users: countUsers.rows[0].count,
        tenants: countTenants.rows[0].count,
        plugins: countPlugins.rows[0].count
      });
      
      // Delete
      await pool.query('DELETE FROM user_plugin_access WHERE user_id != $1', [SUPERUSER_ID]);
      await pool.query('DELETE FROM tenants WHERE user_id != $1', [SUPERUSER_ID]);
      await pool.query('DELETE FROM users WHERE id != $1', [SUPERUSER_ID]);
      
      console.log('✅ Cleanup complete!');
      
      res.json({ 
        success: true,
        message: 'Cleanup complete',
        deleted: {
          users: countUsers.rows[0].count,
          tenants: countTenants.rows[0].count,
          plugins: countPlugins.rows[0].count
        }
      });
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
      res.status(500).json({ error: 'Cleanup failed', details: error.message });
    }
  });
};

// plugins/channels/model.js
// Channels model - handles channel CRUD with product mapping and aggregation with multi-tenant support
class ChannelsModel {
  constructor(pool) {
    this.defaultPool = pool;
  }

  getPool(req) {
    return req.tenantPool || this.defaultPool;
  }

  async getAll(req, userId) {
    const pool = this.getPool(req);
    const query = `
      SELECT 
        c.*,
        json_agg(
          json_build_object(
            'id', cpm.id,
            'product_id', cpm.product_id,
            'product_name', p.name,
            'product_sku', p.sku,
            'channel_id', cpm.channel_id
          )
        ) FILTER (WHERE cpm.id IS NOT NULL) as products
      FROM channels c
      LEFT JOIN channel_product_map cpm ON c.id = cpm.channel_id
      LEFT JOIN products p ON cpm.product_id = p.id
      WHERE c.user_id = $1
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `;
    
    const result = await pool.query(query, [userId]);
    
    return result.rows.map(row => ({
      id: row.id.toString(),
      name: row.name,
      type: row.type,
      apiKey: row.api_key,
      apiUrl: row.api_url,
      isActive: row.is_active,
      products: row.products || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async getById(req, userId, channelId) {
    const pool = this.getPool(req);
    const query = `
      SELECT 
        c.*,
        json_agg(
          json_build_object(
            'id', cpm.id,
            'product_id', cpm.product_id,
            'product_name', p.name,
            'product_sku', p.sku,
            'channel_id', cpm.channel_id
          )
        ) FILTER (WHERE cpm.id IS NOT NULL) as products
      FROM channels c
      LEFT JOIN channel_product_map cpm ON c.id = cpm.channel_id
      LEFT JOIN products p ON cpm.product_id = p.id
      WHERE c.id = $1 AND c.user_id = $2
      GROUP BY c.id
    `;
    
    const result = await pool.query(query, [channelId, userId]);
    
    if (!result.rows.length) {
      return null;
    }
    
    const row = result.rows[0];
    return {
      id: row.id.toString(),
      name: row.name,
      type: row.type,
      apiKey: row.api_key,
      apiUrl: row.api_url,
      isActive: row.is_active,
      products: row.products || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async create(req, userId, channelData) {
    const pool = this.getPool(req);
    const result = await pool.query(`
      INSERT INTO channels (user_id, name, type, api_key, api_url, is_active)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      userId,
      channelData.name,
      channelData.type,
      channelData.apiKey || null,
      channelData.apiUrl || null,
      channelData.isActive !== undefined ? channelData.isActive : true,
    ]);
    
    const channel = result.rows[0];
    
    return {
      id: channel.id.toString(),
      name: channel.name,
      type: channel.type,
      apiKey: channel.api_key,
      apiUrl: channel.api_url,
      isActive: channel.is_active,
      products: [],
      createdAt: channel.created_at,
      updatedAt: channel.updated_at,
    };
  }

  async update(req, userId, channelId, channelData) {
    const pool = this.getPool(req);
    const result = await pool.query(`
      UPDATE channels
      SET name = $3, type = $4, api_key = $5, api_url = $6, is_active = $7, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `, [
      channelId,
      userId,
      channelData.name,
      channelData.type,
      channelData.apiKey || null,
      channelData.apiUrl || null,
      channelData.isActive !== undefined ? channelData.isActive : true,
    ]);
    
    if (!result.rows.length) {
      throw new Error('Channel not found');
    }
    
    return this.getById(req, userId, channelId);
  }

  async delete(req, userId, channelId) {
    const pool = this.getPool(req);
    const result = await pool.query(
      'DELETE FROM channels WHERE id = $1 AND user_id = $2 RETURNING id',
      [channelId, userId]
    );
    
    if (!result.rows.length) {
      throw new Error('Channel not found');
    }
    
    return { id: channelId };
  }

  // Product mapping methods
  async addProduct(req, userId, channelId, productId) {
    const pool = this.getPool(req);
    // Verify channel ownership
    const channelCheck = await pool.query(
      'SELECT id FROM channels WHERE id = $1 AND user_id = $2',
      [channelId, userId]
    );
    
    if (!channelCheck.rows.length) {
      throw new Error('Channel not found or access denied');
    }
    
    // Verify product ownership
    const productCheck = await pool.query(
      'SELECT id FROM products WHERE id = $1 AND user_id = $2',
      [productId, userId]
    );
    
    if (!productCheck.rows.length) {
      throw new Error('Product not found or access denied');
    }
    
    // Add mapping
    const result = await pool.query(`
      INSERT INTO channel_product_map (channel_id, product_id)
      VALUES ($1, $2)
      ON CONFLICT (channel_id, product_id) DO NOTHING
      RETURNING *
    `, [channelId, productId]);
    
    return this.getById(req, userId, channelId);
  }

  async removeProduct(req, userId, channelId, productId) {
    const pool = this.getPool(req);
    // Verify channel ownership
    const channelCheck = await pool.query(
      'SELECT id FROM channels WHERE id = $1 AND user_id = $2',
      [channelId, userId]
    );
    
    if (!channelCheck.rows.length) {
      throw new Error('Channel not found or access denied');
    }
    
    await pool.query(
      'DELETE FROM channel_product_map WHERE channel_id = $1 AND product_id = $2',
      [channelId, productId]
    );
    
    return this.getById(req, userId, channelId);
  }
}

module.exports = ChannelsModel;
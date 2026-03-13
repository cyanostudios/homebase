// plugins/settings/model.js
// User settings CRUD using main pool (user_settings table in auth DB)

class SettingsModel {
  constructor(pool) {
    this.pool = pool;
  }

  async getAll(userId) {
    const result = await this.pool.query(
      'SELECT category, settings FROM user_settings WHERE user_id = $1',
      [userId],
    );
    const settings = {};
    result.rows.forEach((row) => {
      settings[row.category] = row.settings;
    });
    return settings;
  }

  async getCategory(userId, category) {
    const result = await this.pool.query(
      'SELECT settings FROM user_settings WHERE user_id = $1 AND category = $2',
      [userId, category],
    );
    return result.rows.length ? result.rows[0].settings : {};
  }

  async updateCategory(userId, category, settings) {
    // Use JSONB || merge so partial updates (e.g. only viewMode) don't wipe
    // unrelated keys (e.g. tags saved from the settings form).
    const result = await this.pool.query(
      `INSERT INTO user_settings (user_id, category, settings, updated_at)
       VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, category)
       DO UPDATE SET
         settings    = user_settings.settings || EXCLUDED.settings,
         updated_at  = CURRENT_TIMESTAMP
       RETURNING settings`,
      [userId, category, JSON.stringify(settings)],
    );
    return result.rows[0].settings;
  }
}

module.exports = SettingsModel;

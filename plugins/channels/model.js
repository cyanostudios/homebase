// plugins/channels/model.js
// Channels sammanställning baserad på befintliga tabeller:
// - channel_product_map: per produkt/per kanal toggle + sync-status
// - woocommerce_settings: indikerar om Woo är konfigurerad
//
// Behåller mall-strukturen (model/controller/routes), men använder inte en egen TABLE.
// getAll() returnerar en lista av kanal-sammanställningar för aktuell user_id.

class ChannelsModel {
  constructor(pool) {
    this.pool = pool;
  }

  static CHANNEL_MAP_TABLE = 'channel_product_map';
  static WOO_SETTINGS_TABLE = 'woocommerce_settings';

  // Listar alla kanaler med räknare
  async getAll(userId) {
    // 1) Hämta kanaler som finns i map-tabellen
    const channelsRes = await this.pool.query(
      `SELECT DISTINCT channel FROM ${ChannelsModel.CHANNEL_MAP_TABLE} WHERE user_id = $1`,
      [userId]
    );
    const channels = channelsRes.rows.map(r => r.channel);

    // 2) Woo konfigurerad?
    const wooCfgRes = await this.pool.query(
      `SELECT 1 FROM ${ChannelsModel.WOO_SETTINGS_TABLE} WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    const wooConfigured = wooCfgRes.rowCount > 0;

    // 3) Samla ihop set av kanaler (lägg till 'woocommerce' om konfigurerad)
    const set = new Set(channels);
    if (wooConfigured) set.add('woocommerce');

    const summaries = [];
    for (const ch of set) {
      const statRes = await this.pool.query(
        `
        SELECT
          COUNT(*)::int AS mapped_count,
          COUNT(*) FILTER (WHERE enabled)             ::int AS enabled_count,
          COUNT(*) FILTER (WHERE last_sync_status='success')::int AS success_count,
          COUNT(*) FILTER (WHERE last_sync_status='error')  ::int AS error_count,
          COUNT(*) FILTER (WHERE last_sync_status='queued') ::int AS queued_count,
          COUNT(*) FILTER (WHERE last_sync_status='idle')   ::int AS idle_count,
          MAX(last_synced_at) AS last_synced_at
        FROM ${ChannelsModel.CHANNEL_MAP_TABLE}
        WHERE user_id = $1 AND channel = $2
        `,
        [userId, ch]
      );
      const s = statRes.rows[0] || {};

      summaries.push({
        id: ch,                          // panel/item id = kanalnyckel
        channel: ch,                     // t.ex. 'woocommerce', 'fyndiq', 'cdon'
        configured: ch === 'woocommerce' ? wooConfigured : (s.mapped_count || 0) > 0,
        mappedCount: s.mapped_count || 0,
        enabledCount: s.enabled_count || 0,
        status: {
          success: s.success_count || 0,
          error:   s.error_count   || 0,
          queued:  s.queued_count  || 0,
          idle:    s.idle_count    || 0,
        },
        lastSyncedAt: s.last_synced_at || null,
        // framtida fält: connection, rateLimits, queueDepth etc.
      });
    }

    // Sortera alfabetiskt för stabilitet
    return summaries.sort((a, b) => String(a.channel).localeCompare(String(b.channel)));
  }

  // Nedan endpoints behövs inte för MVP i Channels; behåll för paritet eller kasta Not Implemented
  async create()  { throw new Error('Not implemented'); }
  async update()  { throw new Error('Not implemented'); }
  async delete()  { throw new Error('Not implemented'); }

  // transformRow ej använd; behåll ej onödiga delar
}

module.exports = ChannelsModel;

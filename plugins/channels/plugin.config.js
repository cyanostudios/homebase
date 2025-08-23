/**
 * Channels plugin – listar/övervakar försäljningskanaler (WooCommerce, Fyndiq, CDON, …)
 * och exponerar API för per-produkt per-kanal toggle/overrides (MVP i nästa steg).
 */
module.exports = {
  name: 'channels',                // plural-kebab
  routeBase: '/api/channels',      // måste matcha name
  requiredRole: 'user',
  description: 'Channels hub: status/metrics för marknadsplatser och produkt-kopplingar.',
};

/**
 * Channels plugin – listar/övervakar försäljningskanaler (WooCommerce, Fyndiq, CDON, …)
 * och exponerar API för per-produkt per-kanal toggle/overrides.
 */
module.exports = {
  name: 'channels',
  routeBase: '/api/channels',
  requiredRole: 'user',
  description: 'Channels hub: status/metrics för marknadsplatser och produkt-kopplingar.',
};

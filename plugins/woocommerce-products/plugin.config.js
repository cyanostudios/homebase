/**
 * WooCommerce Products plugin config
 * Provides settings storage, connection test, product export/import, and batch delete.
 */
module.exports = {
  name: 'woocommerce-products',
  routeBase: '/api/woocommerce-products',
  requiredRole: 'user',
  description: 'WooCommerce channel: settings + product export (Phase 1).',
};

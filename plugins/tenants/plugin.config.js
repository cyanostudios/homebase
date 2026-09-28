// plugins/tenants/plugin.config.js
module.exports = {
  name: 'tenants',
  routeBase: '/api/tenants',
  requiredRole: 'user',
  description: 'Platform admin: list tenants and toggle plugin access (code allowlist only)',
};

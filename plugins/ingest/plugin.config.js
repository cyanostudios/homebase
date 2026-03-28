// plugins/ingest/plugin.config.js
module.exports = {
  name: 'ingest',
  routeBase: '/api/ingest',
  requiredRole: 'user',
  description:
    'Register external sources, fetch URL content, and store import history for reuse by other plugins.',
};

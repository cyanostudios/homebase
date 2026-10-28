// plugins/site-audits/plugin.config.js
module.exports = {
  name: 'site-audits',
  routeBase: '/api/site-audits',
  requiredRole: 'user',
  description: 'Technical SEO audits for arbitrary public sites (homepage + crawl, scored 0-100).',
};

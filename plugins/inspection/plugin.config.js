/**
 * Inspection (Besiktningar) plugin
 * Manages inspection projects with text and files, and email to craftsmen
 */
module.exports = {
  name: 'inspection',
  routeBase: '/api/inspection',
  requiredRole: 'user',
  description: 'Inspection projects and email to craftsmen',
};

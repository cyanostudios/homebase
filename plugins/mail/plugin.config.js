/**
 * Mail plugin
 * Provides email sending and history for use by other plugins
 */
module.exports = {
  name: 'mail',
  routeBase: '/api/mail',
  requiredRole: 'user',
  description: 'Email sending and history for plugins',
};

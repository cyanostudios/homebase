/**
 * Pulse plugin – SMS notifications via Twilio (or Mock for development)
 * Per-user settings, shared send service for other plugins
 */
module.exports = {
  name: 'pulses',
  routeBase: '/api/pulses',
  requiredRole: 'user',
  description: 'SMS sending and history for plugins',
};

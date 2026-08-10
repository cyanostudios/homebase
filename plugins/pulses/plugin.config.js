/**
 * Pulse plugin – SMS notifications via multi-provider catalog + routing
 * (Twilio / Mock send in v1; Twilio Verify & Stytch catalog-only).
 */
module.exports = {
  name: 'pulses',
  routeBase: '/api/pulses',
  requiredRole: 'user',
  description: 'SMS sending, provider management, routing and history for plugins',
};

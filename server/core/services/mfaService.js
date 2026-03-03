// server/core/services/mfaService.js
// TOTP (authenticator app) support for two-factor authentication

const speakeasy = require('speakeasy');

/**
 * Generate a new TOTP secret for a user
 * @param {string} email - User email (used as otpauth issuer)
 * @returns {{ secret: string, otpauthUrl: string }}
 */
function generateSecret(email) {
  const secret = speakeasy.generateSecret({
    name: `Homebase (${email})`,
    issuer: 'Homebase',
    length: 32,
  });
  return {
    secret: secret.base32,
    otpauthUrl: secret.otpauth_url,
  };
}

/**
 * Verify a TOTP token against the secret
 * @param {string} secret - Base32 TOTP secret
 * @param {string} token - 6-digit code from authenticator app
 * @returns {boolean}
 */
function verifyToken(secret, token) {
  if (!secret || !token) return false;
  const code = String(token).replace(/\s/g, '');
  if (!/^\d{6}$/.test(code)) return false;
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token: code,
    window: 1,
  });
}

module.exports = {
  generateSecret,
  verifyToken,
};

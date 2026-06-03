const crypto = require('crypto');
const ServiceManager = require('../../ServiceManager');
const UserService = require('../user/UserService');
const { getSystemEmailService, isSystemEmailConfigured } = require('../email/systemEmail');

const TOKEN_BYTES = 32;
const EXPIRY_MS = 60 * 60 * 1000; // 1 hour

class PasswordResetService {
  constructor() {
    this.logger = ServiceManager.get('logger');
    this.userService = new UserService();
  }

  _getPool() {
    return this.userService._getPool();
  }

  _hashToken(token) {
    return crypto.createHash('sha256').update(String(token)).digest('hex');
  }

  _resetLink(token) {
    const base = (process.env.FRONTEND_URL || 'http://localhost:3001').replace(/\/+$/, '');
    return `${base}/reset-password/${token}`;
  }

  async _ensureTable() {
    const db = this._getPool();
    const rows = await db.query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'password_reset_tokens'`,
    );
    if (!rows?.length) {
      const err = new Error('Password reset is not available (database migration required)');
      err.code = 'PASSWORD_RESET_NOT_CONFIGURED';
      throw err;
    }
  }

  /**
   * Request a reset email. Always returns success to avoid email enumeration.
   */
  async requestReset(email) {
    const normalized = String(email || '')
      .trim()
      .toLowerCase();
    if (!normalized) {
      return { ok: true };
    }

    await this._ensureTable();

    const db = this._getPool();
    const users = await db.query('SELECT id, email FROM users WHERE LOWER(email) = LOWER($1)', [
      normalized,
    ]);
    const user = users?.[0];
    if (!user) {
      this.logger.info('Password reset requested for unknown email', { email: normalized });
      return { ok: true };
    }

    const token = crypto.randomBytes(TOKEN_BYTES).toString('hex');
    const tokenHash = this._hashToken(token);
    const expiresAt = new Date(Date.now() + EXPIRY_MS);

    await db.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [user.id]);
    await db.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, tokenHash, expiresAt],
    );

    const link = this._resetLink(token);
    const emailService = getSystemEmailService();

    if (!emailService) {
      if (process.env.NODE_ENV === 'development') {
        this.logger.info('Password reset link (no email provider configured)', {
          email: user.email,
          link,
        });
        console.log('\n[dev] Password reset link:', link, '\n');
        return { ok: true, devLink: link };
      }
      const err = new Error(
        'Email is not configured on the server. Contact an administrator to reset your password.',
      );
      err.code = 'EMAIL_NOT_CONFIGURED';
      throw err;
    }

    const appName = process.env.APP_NAME || 'Homebase';
    await emailService.send({
      to: user.email,
      subject: `${appName} — reset your password`,
      text: `You requested a password reset. Open this link within 1 hour:\n\n${link}\n\nIf you did not request this, you can ignore this email.`,
      html: `<p>You requested a password reset for ${appName}.</p>
<p><a href="${link}">Reset your password</a></p>
<p>This link expires in 1 hour. If you did not request a reset, you can ignore this email.</p>
<p style="color:#666;font-size:12px;">${link}</p>`,
    });

    this.logger.info('Password reset email sent', { userId: user.id, email: user.email });
    return { ok: true };
  }

  /**
   * Set a new password using a valid reset token.
   */
  async resetPassword(token, newPassword) {
    const rawToken = String(token || '').trim();
    if (!rawToken || rawToken.length < 32) {
      throw new Error('Invalid or expired reset link');
    }
    if (!newPassword || String(newPassword).length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    await this._ensureTable();

    const db = this._getPool();
    const tokenHash = this._hashToken(rawToken);
    const rows = await db.query(
      `SELECT id, user_id FROM password_reset_tokens
       WHERE token_hash = $1 AND expires_at > NOW() AND used_at IS NULL
       LIMIT 1`,
      [tokenHash],
    );
    const row = rows?.[0];
    if (!row) {
      throw new Error('Invalid or expired reset link');
    }

    await this.userService.updatePassword(row.user_id, newPassword);
    await db.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1', [row.id]);
    await db.query('DELETE FROM password_reset_tokens WHERE user_id = $1 AND id <> $2', [
      row.user_id,
      row.id,
    ]);

    this.logger.info('Password reset completed', { userId: row.user_id });
    return { ok: true };
  }
}

module.exports = PasswordResetService;
module.exports.isSystemEmailConfigured = isSystemEmailConfigured;

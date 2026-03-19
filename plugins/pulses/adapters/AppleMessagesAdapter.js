/**
 * Apple Messages adapter – sends SMS via macOS Messages.app using AppleScript.
 *
 * Requires:
 *   - macOS (uses osascript)
 *   - iPhone on the same Apple ID as this Mac
 *   - "Text Message Forwarding" enabled on iPhone for this Mac
 *     (iPhone Settings → Messages → Text Message Forwarding)
 *
 * Messages are sent as SMS through the carrier (not iMessage), using the iPhone
 * as a relay. Any phone number can receive the message as a plain SMS.
 */
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

/**
 * Escape a string for use inside an AppleScript double-quoted string.
 * Backslashes and double-quotes must be escaped; newlines replaced with spaces.
 */
function escapeForAppleScript(str) {
  if (str == null) return '';
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r\n|\r|\n/g, ' ');
}

class AppleMessagesAdapter {
  constructor(_config = {}) {
    // No credentials required; uses the Mac's Messages app with iPhone SMS relay
  }

  /**
   * Send an SMS via Messages.app using the iPhone SMS relay service.
   *
   * Uses `participant` (not `buddy`) so any phone number works even without
   * an existing conversation. Finds the SMS service by service type rather than
   * by name to be resilient to locale differences.
   *
   * @param {object} options - { to: string, body: string }
   * @returns {Promise<{ sid: string, status: string }>}
   */
  async send(options) {
    const to = typeof options.to === 'string' ? options.to.trim() : '';
    const body = options.body != null ? String(options.body) : '';
    if (!to) {
      throw new Error('SMS recipient (to) is required');
    }
    const safeTo = escapeForAppleScript(to);
    const safeBody = escapeForAppleScript(body || ' ');

    // Find the SMS service by type (more reliable than name, works regardless of locale).
    // Use `participant` instead of `buddy` so any phone number works, even without
    // an existing conversation or contact entry.
    const args = [
      '-e',
      'tell application "Messages"',
      '-e',
      'set svc to first service whose service type = SMS',
      '-e',
      `set tgt to participant "${safeTo}" of svc`,
      '-e',
      `send "${safeBody}" to tgt`,
      '-e',
      'end tell',
    ];

    try {
      await execFileAsync('osascript', args, { timeout: 20000 });
      return { sid: 'apple_' + Date.now(), status: 'sent' };
    } catch (err) {
      const stderr = (err.stderr || '').trim();
      const msg = stderr || err.message || String(err);

      if (msg.includes('service type = SMS') || msg.includes('first service')) {
        throw new Error(
          'Could not find the SMS service in Messages. Make sure your iPhone is on the same Apple ID as this Mac and has "Text Message Forwarding" enabled (iPhone Settings → Messages → Text Message Forwarding).',
        );
      }
      throw new Error('Apple Messages send failed: ' + msg);
    }
  }
}

module.exports = AppleMessagesAdapter;

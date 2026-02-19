/**
 * Mock SMS adapter – logs but does not send (for dev/test)
 */
const { Logger } = require('@homebase/core');

class MockAdapter {
  constructor(_config = {}) {
    // No config required for mock
  }

  /**
   * Pretend to send SMS; log and return success
   * @param {object} options - { to: string, body: string }
   * @returns {Promise<{ sid: string, status: string }>}
   */
  async send(options) {
    const to = typeof options.to === 'string' ? options.to.trim() : '';
    const body = options.body != null ? String(options.body) : '';
    Logger.info('MockAdapter: would send SMS', { to, bodyLength: body.length });
    return { sid: 'mock_' + Date.now(), status: 'sent' };
  }
}

module.exports = MockAdapter;

// plugins/sportadmin/client/httpClient.js
const axios = require('axios');
const { validatePublicHttpsUrl } = require('../../../server/core/utils/ssrfUrlGuard');

const DEFAULT_TIMEOUT_MS = 20000;
const MAX_RETRIES = 2;
const USER_AGENT = 'HomebaseSportAdminConnector/0.1 (+https://homebase.se)';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fixed SportAdmin platform hosts (CDN, portal, club *.web.sportadmin.se).
 * Custom club domains are NOT on this list — they need `siteHost` from config.
 * @param {string} hostname
 * @returns {boolean}
 */
function isAllowedSportadminHost(hostname) {
  const host = String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/\.$/, '');
  if (!host) {
    return false;
  }
  if (
    host === 'cdn.sportadmin.se' ||
    host === 'portalweb.sportadmin.se' ||
    host === 'sportadmin.se' ||
    host === 'www.sportadmin.se'
  ) {
    return true;
  }
  if (host.endsWith('.web.sportadmin.se') || host === 'web.sportadmin.se') {
    return true;
  }
  return false;
}

/**
 * Allow fetch if host is on the fixed SportAdmin list, or equals the configured
 * club site host (custom domain such as www.sorgenfriff.se).
 * siteHost must already be a public HTTPS hostname from saved/candidate config —
 * never pass an attacker-controlled value except the single admin-configured site URL.
 *
 * @param {string} urlString
 * @param {{ siteHost?: string|null }} [opts]
 * @returns {{ ok: true, url: URL } | { ok: false, error: string }}
 */
function assertFetchUrlAllowed(urlString, opts = {}) {
  const base = validatePublicHttpsUrl(urlString);
  if (!base.ok) {
    return base;
  }
  const host = base.url.hostname.toLowerCase().replace(/\.$/, '');
  if (isAllowedSportadminHost(host)) {
    return base;
  }
  const siteHost = String(opts.siteHost || '')
    .trim()
    .toLowerCase()
    .replace(/\.$/, '');
  if (siteHost && host === siteHost) {
    return base;
  }
  return { ok: false, error: 'URL host is not an allowed SportAdmin host' };
}

/**
 * Rate-limited sequential HTTP GET with backoff.
 */
class SportadminHttpClient {
  /**
   * @param {{ siteHost?: string|null, concurrency?: number, timeoutMs?: number }} [options]
   */
  constructor(options = {}) {
    this.siteHost = options.siteHost || null;
    this.timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
    this.queue = Promise.resolve();
    this.active = 0;
    this.maxConcurrent = Math.max(1, options.concurrency || 1);
  }

  /**
   * @param {string} url
   * @returns {Promise<{ ok: true, url: string, status: number, body: string, contentType: string|null } | { ok: false, url: string, status: number|null, error: string }>}
   */
  async get(url) {
    const run = async () => {
      while (this.active >= this.maxConcurrent) {
        await sleep(50);
      }
      this.active += 1;
      try {
        return await this.#getWithRetry(url);
      } finally {
        this.active -= 1;
      }
    };
    const next = this.queue.then(run, run);
    this.queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  async #getWithRetry(url) {
    const gateOpts = { siteHost: this.siteHost };
    const check = assertFetchUrlAllowed(url, gateOpts);
    if (!check.ok) {
      return { ok: false, url, status: null, error: check.error };
    }

    let lastError = 'Request failed';
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      try {
        const response = await axios.get(check.url.href, {
          timeout: this.timeoutMs,
          maxRedirects: 5,
          responseType: 'arraybuffer',
          headers: {
            'User-Agent': USER_AGENT,
            Accept: 'text/html,application/xhtml+xml,text/calendar,*/*;q=0.8',
          },
          validateStatus: () => true,
        });

        const finalUrl = String(response.request?.res?.responseUrl || check.url.href);
        const finalCheck = assertFetchUrlAllowed(finalUrl, gateOpts);
        if (!finalCheck.ok) {
          return { ok: false, url: finalUrl, status: response.status, error: finalCheck.error };
        }

        if (response.status >= 500 && attempt < MAX_RETRIES) {
          await sleep(300 * 2 ** attempt);
          continue;
        }

        const contentType = response.headers['content-type'] || null;
        const encoding = /charset=([\w-]+)/i.exec(contentType || '')?.[1] || 'latin1';
        let body;
        try {
          body = Buffer.from(response.data).toString(encoding === 'utf-8' ? 'utf8' : 'latin1');
        } catch {
          body = Buffer.from(response.data).toString('latin1');
        }

        if (response.status >= 400) {
          return {
            ok: false,
            url: finalUrl,
            status: response.status,
            error: `HTTP ${response.status}`,
          };
        }

        return {
          ok: true,
          url: finalUrl,
          status: response.status,
          body,
          contentType,
        };
      } catch (err) {
        lastError = err?.message || 'Request failed';
        if (attempt < MAX_RETRIES) {
          await sleep(300 * 2 ** attempt);
          continue;
        }
      }
    }

    return { ok: false, url, status: null, error: lastError };
  }
}

module.exports = {
  SportadminHttpClient,
  assertFetchUrlAllowed,
  isAllowedSportadminHost,
  USER_AGENT,
};

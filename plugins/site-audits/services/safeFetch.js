// plugins/site-audits/services/safeFetch.js
// SSRF-hardened outbound GET for site-audits. Deliberately avoids axios/puppeteer so the
// DNS resolution step can be fully controlled (custom `lookup`), which is what actually
// prevents DNS-rebinding SSRF: the IP is validated *at connect time*, not just when the
// URL string is first parsed.
const http = require('http');
const https = require('https');
const dns = require('dns');
const { isIP } = require('net');
const { validateAuditUrl, isPrivateIp } = require('./urlGuard');

const USER_AGENT = 'HomebaseSiteAudits/1.0 (+https://homebase.se)';
const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 15000;
const MAX_BYTES = 2 * 1024 * 1024; // 2 MiB
const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);

/**
 * Builds a `lookup` function (same signature as dns.lookup) that only ever hands back
 * public IP addresses to the HTTP client. If every resolved address is private/reserved,
 * resolution fails closed and the connection is never attempted.
 */
function createSafeLookup() {
  return function safeLookup(hostname, optionsOrCallback, maybeCallback) {
    const options = typeof optionsOrCallback === 'function' ? {} : optionsOrCallback || {};
    const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback;

    dns.lookup(hostname, { all: true, verbatim: true }, (err, addresses) => {
      if (err) {
        callback(err);
        return;
      }
      const list = Array.isArray(addresses) ? addresses : [addresses].filter(Boolean);
      const safe = list.filter((entry) => entry && !isPrivateIp(entry.address));
      if (!safe.length) {
        callback(
          new Error(`${hostname} resolved only to private/blocked addresses; refusing to connect`),
        );
        return;
      }
      if (options.all) {
        callback(null, safe);
        return;
      }
      callback(null, safe[0].address, safe[0].family);
    });
  };
}

/**
 * Single (non-redirect-following) GET request with a body cap, timeout, and no cookies.
 * @returns {Promise<{ statusCode: number, headers: Object, body: string, truncated: boolean }>}
 */
function singleGet(targetUrl, extraHeaders = null) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(targetUrl);
    } catch (err) {
      reject(err);
      return;
    }

    const isHttps = parsed.protocol === 'https:';
    const transport = isHttps ? https : http;
    // URL.hostname keeps brackets around IPv6 literals; http.request expects them stripped.
    // IP literals often skip the custom lookup, so reject private addresses here as well.
    const hostname =
      parsed.hostname.startsWith('[') && parsed.hostname.endsWith(']')
        ? parsed.hostname.slice(1, -1)
        : parsed.hostname;
    if (isIP(hostname) && isPrivateIp(hostname)) {
      reject(new Error(`${hostname} is a private/reserved address; refusing to connect`));
      return;
    }

    const headers = {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      // Deliberately no Cookie header — audits never forward or persist site cookies.
    };
    if (extraHeaders && typeof extraHeaders === 'object') {
      for (const [key, value] of Object.entries(extraHeaders)) {
        if (value == null) continue;
        const lower = String(key).toLowerCase();
        // Never allow Cookie / Authorization overrides.
        if (lower === 'cookie' || lower === 'authorization') continue;
        headers[key] = value;
      }
    }

    const reqOptions = {
      method: 'GET',
      hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: `${parsed.pathname || '/'}${parsed.search || ''}`,
      lookup: createSafeLookup(),
      timeout: TIMEOUT_MS,
      headers,
    };

    const chunks = [];
    let total = 0;
    let truncated = false;
    let settled = false;
    let deadlineTimer = null;

    const stopDeadline = () => {
      if (deadlineTimer) {
        clearTimeout(deadlineTimer);
        deadlineTimer = null;
      }
    };

    const req = transport.request(reqOptions, (res) => {
      const finalize = () => {
        if (settled) return;
        settled = true;
        stopDeadline();
        resolve({
          statusCode: res.statusCode,
          headers: res.headers || {},
          body: Buffer.concat(chunks).toString('utf8'),
          truncated,
        });
      };

      res.on('data', (chunk) => {
        if (truncated) return;
        total += chunk.length;
        if (total > MAX_BYTES) {
          const alreadyHave = total - chunk.length;
          const allowed = MAX_BYTES - alreadyHave;
          if (allowed > 0) {
            chunks.push(chunk.subarray(0, allowed));
          }
          truncated = true;
          // Stop downloading the rest of the body; we keep what we have instead of failing
          // the whole fetch, since the <head> we need for SEO checks is already captured.
          res.destroy();
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', finalize);
      res.on('close', finalize);
      res.on('error', (err) => {
        if (truncated) {
          finalize();
          return;
        }
        if (!settled) {
          settled = true;
          stopDeadline();
          reject(err);
        }
      });
    });

    // `timeout` on the request is an idle socket timer: a slow-drip body resets it and can
    // hold a crawl slot indefinitely. This wall-clock deadline aborts the request 15s after
    // it starts, whether or not bytes are still arriving. ADR: 15s per request.
    const abortForDeadline = () => {
      req.destroy(new Error('Request timed out'));
    };
    deadlineTimer = setTimeout(abortForDeadline, TIMEOUT_MS);
    if (deadlineTimer && typeof deadlineTimer.unref === 'function') {
      deadlineTimer.unref();
    }

    req.on('timeout', abortForDeadline);
    req.on('error', (err) => {
      if (!settled) {
        settled = true;
        stopDeadline();
        reject(err);
      }
    });
    req.end();
  });
}

/**
 * SSRF-safe GET with manual redirect handling (each hop re-validated), size/time caps.
 * Never throws — failures are reported via the `ok`/`error` fields so callers (crawler,
 * run jobs) can record a finding/error instead of crashing.
 * @param {string} url
 * @param {{ extraHeaders?: Object }} [options] - optional request headers (no Cookie/Authorization)
 * @returns {Promise<{
 *   ok: boolean,
 *   finalUrl: string,
 *   statusCode: number|null,
 *   headers: Object|null,
 *   body: string|null,
 *   elapsedMs: number,
 *   redirects: Array<{ from: string, to: string, statusCode: number }>,
 *   error: string|null
 * }>}
 */
async function safeFetch(url, options = {}) {
  const start = Date.now();
  const redirects = [];
  let currentUrl = url;
  const extraHeaders = options?.extraHeaders || null;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const check = validateAuditUrl(currentUrl);
    if (!check.ok) {
      return {
        ok: false,
        finalUrl: currentUrl,
        statusCode: null,
        headers: null,
        body: null,
        elapsedMs: Date.now() - start,
        redirects,
        error: check.error,
      };
    }

    let response;
    try {
      // eslint-disable-next-line no-await-in-loop
      response = await singleGet(currentUrl, extraHeaders);
    } catch (err) {
      return {
        ok: false,
        finalUrl: currentUrl,
        statusCode: null,
        headers: null,
        body: null,
        elapsedMs: Date.now() - start,
        redirects,
        error: err?.message || 'Request failed',
      };
    }

    const { statusCode, headers, body } = response;
    const location = headers?.location;
    if (REDIRECT_STATUS_CODES.has(statusCode) && location) {
      if (hop >= MAX_REDIRECTS) {
        return {
          ok: false,
          finalUrl: currentUrl,
          statusCode,
          headers,
          body: null,
          elapsedMs: Date.now() - start,
          redirects,
          error: 'Too many redirects',
        };
      }
      let nextUrl;
      try {
        nextUrl = new URL(location, currentUrl).toString();
      } catch {
        return {
          ok: false,
          finalUrl: currentUrl,
          statusCode,
          headers,
          body: null,
          elapsedMs: Date.now() - start,
          redirects,
          error: `Invalid redirect Location header: ${location}`,
        };
      }
      redirects.push({ from: currentUrl, to: nextUrl, statusCode });
      currentUrl = nextUrl;
      // eslint-disable-next-line no-continue
      continue;
    }

    return {
      ok: statusCode >= 200 && statusCode < 400,
      finalUrl: currentUrl,
      statusCode,
      headers,
      body,
      elapsedMs: Date.now() - start,
      redirects,
      error: statusCode >= 400 ? `HTTP ${statusCode}` : null,
    };
  }

  return {
    ok: false,
    finalUrl: currentUrl,
    statusCode: null,
    headers: null,
    body: null,
    elapsedMs: Date.now() - start,
    redirects,
    error: 'Too many redirects',
  };
}

module.exports = {
  safeFetch,
  createSafeLookup,
  USER_AGENT,
  MAX_REDIRECTS,
  TIMEOUT_MS,
  MAX_BYTES,
};

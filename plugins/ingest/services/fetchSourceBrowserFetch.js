// plugins/ingest/services/fetchSourceBrowserFetch.js
// Headless browser fetch for ingest — separate strategy from generic_http (axios).
const MAX_EXCERPT = 8000;

/** Fallback if browser.userAgent() is unavailable. */
const BROWSER_FETCH_USER_AGENT_FALLBACK =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * Use the same Chromium build as Puppeteer, but strip “Headless” so UA / TLS major version align.
 * @param {import('puppeteer').Browser} browser
 */
async function resolveStableUserAgent(browser) {
  try {
    const ua = await browser.userAgent();
    return ua
      .replace(/\bHeadlessChrome\b/gi, 'Chrome')
      .replace(/\sHeadless\b/gi, '')
      .trim();
  } catch {
    return BROWSER_FETCH_USER_AGENT_FALLBACK;
  }
}

/**
 * Emulation.UserAgentMetadata aligned with the UA string (reduces Sec-CH-UA mismatches that WAFs use).
 * @param {string} ua
 */
function userAgentMetadataForChromeUa(ua) {
  const chromeMatch = /Chrome\/([\d.]+)/.exec(ua);
  const fullVersion = chromeMatch ? chromeMatch[1] : '124.0.0.0';
  const major = fullVersion.split('.')[0] || '124';
  const notABrandVersion = '24';

  let platform = 'macOS';
  let platformVersion = '14.0.0';
  let architecture = 'arm';
  let bitness = '64';

  if (/Windows NT/i.test(ua)) {
    platform = 'Windows';
    platformVersion = '15.0.0';
    architecture = 'x86';
    bitness = '64';
  } else if (/Linux/i.test(ua) && !/Android/i.test(ua)) {
    platform = 'Linux';
    platformVersion = '';
    architecture = 'x86_64';
    bitness = '64';
  } else if (/Mac OS X/i.test(ua)) {
    platform = 'macOS';
    const macMatch = /Mac OS X ([\d_]+)/.exec(ua);
    platformVersion = macMatch ? macMatch[1].replace(/_/g, '.') : '14.0.0';
    architecture = /arm64|aarch64/i.test(ua) ? 'arm' : 'x86';
  }

  const notABrandFull = `${notABrandVersion}.0.0.0`;
  return {
    brands: [
      { brand: 'Google Chrome', version: major },
      { brand: 'Chromium', version: major },
      { brand: 'Not A(Brand', version: notABrandVersion },
    ],
    fullVersionList: [
      { brand: 'Google Chrome', version: fullVersion },
      { brand: 'Chromium', version: fullVersion },
      { brand: 'Not A(Brand', version: notABrandFull },
    ],
    fullVersion,
    platform,
    platformVersion,
    architecture,
    model: '',
    mobile: false,
    bitness,
  };
}

function browserFetchEnabled() {
  const v = process.env.INGEST_BROWSER_FETCH;
  if (v === undefined || v === '') {
    return false;
  }
  const lower = String(v).toLowerCase();
  return lower === '1' || lower === 'true' || lower === 'yes' || lower === 'on';
}

/**
 * Optional cookie header copied from a real browser session, e.g.:
 * "cf_clearance=...; __cf_bm=..."
 */
function browserFetchCookieHeader() {
  const value = process.env.INGEST_BROWSER_FETCH_COOKIE_HEADER;
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

/**
 * Convert a Cookie header string to Puppeteer cookie objects.
 * @param {string} cookieHeader
 * @param {string} sourceUrl
 */
function parseCookieHeaderForUrl(cookieHeader, sourceUrl) {
  if (!cookieHeader) {
    return [];
  }
  let urlObj;
  try {
    urlObj = new URL(sourceUrl);
  } catch {
    return [];
  }
  return cookieHeader
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const idx = entry.indexOf('=');
      if (idx <= 0) {
        return null;
      }
      const name = entry.slice(0, idx).trim();
      const value = entry.slice(idx + 1).trim();
      if (!name) {
        return null;
      }
      return {
        name,
        value,
        domain: urlObj.hostname,
        path: '/',
        httpOnly: false,
        secure: urlObj.protocol === 'https:',
      };
    })
    .filter(Boolean);
}

/**
 * Heuristic Cloudflare / bot-interstitial detection (observability only, not a bypass).
 * @param {{ html: string, title: string, url: string }} input
 */
function detectCloudflareSignals({ html, title, url }) {
  const urlStr = url || '';
  const titleStr = (title || '').trim();
  const htmlStr = html || '';
  const urlHit = /__cf_chl|cdn-cgi\/challenge|challenge-platform/i.test(urlStr);
  const titleHit =
    /just a moment|attention required|checking your browser|verify you are human|one more step|ddos protection by cloudflare/i.test(
      titleStr,
    );
  const htmlHit =
    /__cf_chl|cf-challenge|challenge-platform|turnstile|checking your browser|ray id:? ?\d|cloudflare ray id/i.test(
      htmlStr,
    );
  return {
    detected: urlHit || titleHit || htmlHit,
    urlHit,
    titleHit,
    htmlHit,
  };
}

/**
 * @param {object} p
 * @param {number|null} p.navigationHttpStatus
 * @param {string|null} p.navigationResponseUrl
 * @param {string} p.finalUrlAfterWait
 * @param {string} p.documentTitle
 * @param {{ detected: boolean, urlHit: boolean, titleHit: boolean, htmlHit: boolean }} p.cf
 */
function buildBrowserFetchDiagnosticComment(p) {
  const payload = {
    strategy: 'browser_fetch',
    navigationHttpStatus: p.navigationHttpStatus,
    navigationResponseUrl: p.navigationResponseUrl,
    finalUrlAfterWait: p.finalUrlAfterWait,
    documentTitle: p.documentTitle,
    cloudflareSignals: p.cf.detected,
    cloudflareSignalHits: {
      url: p.cf.urlHit,
      title: p.cf.titleHit,
      html: p.cf.htmlHit,
    },
    outcome: p.outcome,
  };
  return `<!-- ingest:browser_fetch ${JSON.stringify(payload)} -->\n`;
}

/**
 * Create a readable HTML preview without spending budget on <head>/scripts.
 * Parsing should use full bodyText; this is diagnostic preview only.
 * @param {string} html
 */
function buildHtmlExcerpt(html) {
  if (!html || typeof html !== 'string') {
    return '';
  }

  const mainMatch = html.match(/<main\b[\s\S]*?<\/main>/i);
  const bodyMatch = html.match(/<body\b[\s\S]*?<\/body>/i);
  let candidate = mainMatch?.[0] || bodyMatch?.[0] || html;

  // Strip noisy blocks while keeping semantic structure for quick inspection.
  candidate = candidate
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();

  if (!candidate) {
    return html.slice(0, MAX_EXCERPT);
  }

  return candidate.slice(0, MAX_EXCERPT);
}

/**
 * Same normalized result shape as fetchSource (generic_http). Diagnostics are embedded in excerpt/errorMessage only.
 * @param {string} sourceUrl
 * @returns {Promise<{
 *   ok: boolean,
 *   status: number|null,
 *   contentType: string|null,
 *   contentLength: number|null,
 *   bodyText: string|null,
 *   excerpt: string|null,
 *   finalUrl: string|null,
 *   errorMessage: string|null
 * }>}
 */
async function fetchSourceBrowserFetch(sourceUrl) {
  if (!browserFetchEnabled()) {
    return {
      ok: false,
      status: null,
      contentType: null,
      contentLength: null,
      bodyText: null,
      excerpt: null,
      finalUrl: null,
      errorMessage:
        'browser_fetch is not available on this server: headless browser fetching is disabled. Set environment variable INGEST_BROWSER_FETCH=1 (and ensure OS dependencies for Puppeteer/Chromium are installed), or change the source to generic_http.',
    };
  }

  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch {
    return {
      ok: false,
      status: null,
      contentType: null,
      contentLength: null,
      bodyText: null,
      excerpt: null,
      finalUrl: null,
      errorMessage:
        'browser_fetch is not available: the Puppeteer package could not be loaded. Use generic_http or install dependencies.',
    };
  }

  let browser;
  try {
    const cookieHeader = browserFetchCookieHeader();
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
      ],
    });
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
      if (!window.chrome) {
        window.chrome = { runtime: {} };
      }
    });

    const stableUa = await resolveStableUserAgent(browser);
    const uaMetadata = userAgentMetadataForChromeUa(stableUa);
    try {
      await page.setUserAgent(stableUa, uaMetadata);
    } catch {
      await page.setUserAgent(stableUa);
    }

    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });

    let referer = '';
    try {
      referer = new URL(sourceUrl).origin + '/';
    } catch {
      /* ignore invalid URL */
    }
    await page.setExtraHTTPHeaders({
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
      ...(referer ? { Referer: referer } : {}),
    });
    const parsedCookies = parseCookieHeaderForUrl(cookieHeader, sourceUrl);
    if (parsedCookies.length > 0) {
      await page.setCookie(...parsedCookies);
    }

    page.setDefaultNavigationTimeout(45000);
    const response = await page.goto(sourceUrl, { waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 2500));

    const navigationHttpStatus = response != null ? response.status() : null;
    const navigationResponseUrl =
      response != null && typeof response.url === 'function' ? response.url() : null;
    const finalUrlAfterWait = page.url() || sourceUrl;
    let documentTitle = '';
    try {
      documentTitle = await page.title();
    } catch {
      documentTitle = '';
    }

    const rawCt = response != null ? response.headers()['content-type'] : null;
    const contentType =
      typeof rawCt === 'string' ? rawCt.split(';')[0].trim() || 'text/html' : 'text/html';
    const html = await page.content();
    const cf = detectCloudflareSignals({
      html,
      title: documentTitle,
      url: finalUrlAfterWait,
    });

    /** @type {'success'|'cloudflare_challenge_after_wait'|'http_forbidden'|'http_error'|'navigation_missing'} */
    let outcome;
    if (response == null) {
      outcome = 'navigation_missing';
    } else if (cf.detected) {
      outcome = 'cloudflare_challenge_after_wait';
    } else if (navigationHttpStatus === 403) {
      outcome = 'http_forbidden';
    } else if (
      navigationHttpStatus != null &&
      (navigationHttpStatus < 200 || navigationHttpStatus >= 300)
    ) {
      outcome = 'http_error';
    } else {
      outcome = 'success';
    }

    const ok =
      outcome === 'success' &&
      navigationHttpStatus != null &&
      navigationHttpStatus >= 200 &&
      navigationHttpStatus < 300;

    const diag = buildBrowserFetchDiagnosticComment({
      navigationHttpStatus,
      navigationResponseUrl,
      finalUrlAfterWait,
      documentTitle,
      cf,
      outcome,
    });

    const preview = buildHtmlExcerpt(html);
    const excerptBase = `${diag}${preview}`;
    const buf = Buffer.from(html, 'utf8');
    const contentLength = buf.length;
    const bodyText = html;
    let excerpt = excerptBase.slice(0, MAX_EXCERPT);
    if (excerptBase.length > MAX_EXCERPT) {
      excerpt += '\n…';
    }

    let errorMessage = null;
    if (!ok) {
      if (outcome === 'cloudflare_challenge_after_wait') {
        const navPart =
          navigationHttpStatus != null
            ? `navigation HTTP ${navigationHttpStatus}`
            : 'navigation HTTP status unknown';
        errorMessage = `browser_fetch: Cloudflare challenge still active after wait (${navPart}; final URL after wait: ${finalUrlAfterWait}; title: "${documentTitle.replace(/"/g, "'")}"). Optional: set INGEST_BROWSER_FETCH_COOKIE_HEADER from a real browser session, or use generic_http.`;
      } else if (outcome === 'http_forbidden') {
        errorMessage = `browser_fetch: HTTP 403 (forbidden) — not classified as Cloudflare challenge from page signals; navigation response URL: ${navigationResponseUrl || 'n/a'}; final URL after wait: ${finalUrlAfterWait}.`;
      } else if (outcome === 'navigation_missing') {
        errorMessage =
          'browser_fetch: no navigation response (browser/runtime or redirect edge case); check server logs.';
      } else if (outcome === 'http_error') {
        errorMessage = `browser_fetch: HTTP ${navigationHttpStatus} (navigation response); final URL after wait: ${finalUrlAfterWait}.`;
      }
    }

    return {
      ok,
      status: navigationHttpStatus,
      contentType,
      contentLength,
      bodyText,
      excerpt,
      finalUrl: finalUrlAfterWait,
      errorMessage,
    };
  } catch (err) {
    const msg = err && err.message ? String(err.message) : 'Browser fetch failed';
    const chromeHint = /Chrome|Chromium|executable|browsers install/i.test(msg)
      ? ' From the repository root run: npm run puppeteer:install-chrome (uses .cache/puppeteer).'
      : '';
    const runtimeDiag = `<!-- ingest:browser_fetch ${JSON.stringify({
      strategy: 'browser_fetch',
      outcome: 'runtime_error',
      error: msg.slice(0, 500),
    })} -->\n`;
    return {
      ok: false,
      status: null,
      contentType: null,
      contentLength: null,
      bodyText: null,
      excerpt: runtimeDiag.slice(0, MAX_EXCERPT),
      finalUrl: null,
      errorMessage: `browser_fetch: runtime failure — ${msg}.${chromeHint} Or use generic_http.`,
    };
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        /* ignore */
      }
    }
  }
}

module.exports = {
  fetchSourceBrowserFetch,
  browserFetchEnabled,
};

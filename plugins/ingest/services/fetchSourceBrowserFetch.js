// plugins/ingest/services/fetchSourceBrowserFetch.js
// Headless browser fetch for ingest — separate strategy from generic_http (axios).
const MAX_EXCERPT = 8000;

function browserFetchEnabled() {
  const v = process.env.INGEST_BROWSER_FETCH;
  if (v === undefined || v === '') {
    return false;
  }
  const lower = String(v).toLowerCase();
  return lower === '1' || lower === 'true' || lower === 'yes' || lower === 'on';
}

/**
 * Same normalized result shape as fetchSource (generic_http).
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
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(30000);
    const response = await page.goto(sourceUrl, { waitUntil: 'networkidle2' });
    const status = response != null ? response.status() : 200;
    const finalUrl = page.url() || sourceUrl;
    const rawCt = response != null ? response.headers()['content-type'] : null;
    const contentType =
      typeof rawCt === 'string' ? rawCt.split(';')[0].trim() || 'text/html' : 'text/html';
    const html = await page.content();
    const buf = Buffer.from(html, 'utf8');
    const contentLength = buf.length;
    let bodyText = html.slice(0, MAX_EXCERPT);
    let excerpt = bodyText;
    if (html.length > MAX_EXCERPT) {
      bodyText += '\n…';
      excerpt += '\n…';
    }
    const ok = status >= 200 && status < 300;
    return {
      ok,
      status,
      contentType,
      contentLength,
      bodyText,
      excerpt,
      finalUrl,
      errorMessage: ok ? null : `HTTP ${status}`,
    };
  } catch (err) {
    const msg = err && err.message ? String(err.message) : 'Browser fetch failed';
    const chromeHint = /Chrome|Chromium|executable|browsers install/i.test(msg)
      ? ' From the repository root run: npm run puppeteer:install-chrome (uses .cache/puppeteer).'
      : '';
    return {
      ok: false,
      status: null,
      contentType: null,
      contentLength: null,
      bodyText: null,
      excerpt: null,
      finalUrl: null,
      errorMessage: `browser_fetch failed: ${msg}.${chromeHint} Or use generic_http.`,
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
};

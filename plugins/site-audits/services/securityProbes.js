// plugins/site-audits/services/securityProbes.js
// A short, same-host GET probe of well-known sensitive paths. Not part of the 25-page HTML
// cap. HTTP 200 is not enough (SA-R5): soft-200 HTML and empty bodies are not exposure.
// 401/403/404 are closed. Response bodies are inspected and then dropped — never returned.
const { safeFetch } = require('./safeFetch');

const PROBE_PATHS = Object.freeze([
  '/.env',
  '/.git/HEAD',
  '/wp-config.php',
  '/server-status',
  '/phpinfo.php',
]);

const SIGNATURE_SAMPLE_CHARS = 12000;

const SENSITIVE_ENV_KEY =
  /^(DB_PASSWORD|DATABASE_URL|AWS_SECRET_ACCESS_KEY|AWS_SECRET|SECRET_KEY|APP_KEY|API_KEY|MYSQL_PASSWORD|POSTGRES_PASSWORD)\s*=\s*\S/;

function hostnameOf(urlString) {
  try {
    return new URL(urlString).hostname.toLowerCase().replace(/\.$/, '');
  } catch {
    return null;
  }
}

function looksLikeHtml(body) {
  const head = String(body || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .slice(0, 800);
  return /^<!doctype\s+html/i.test(head) || /^<html[\s>]/i.test(head);
}

function envSignature(text) {
  // A catch-all 200 that returns the site HTML must not count as a leaked env file.
  if (looksLikeHtml(text)) return null;
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
  const assigns = lines.filter((line) => /^[A-Za-z_][A-Za-z0-9_]*\s*=\s*\S/.test(line));
  const sensitive = lines.some((line) => SENSITIVE_ENV_KEY.test(line));
  if (sensitive || assigns.length >= 2) return 'env';
  return null;
}

function gitHeadSignature(text) {
  if (looksLikeHtml(text)) return null;
  const firstLine = text.trim().split(/\r?\n/, 1)[0].trim();
  if (/^ref:\s+refs\/\S+$/.test(firstLine)) return 'git-head';
  if (/^[0-9a-f]{40}$/i.test(firstLine)) return 'git-head';
  return null;
}

function wpConfigSignature(text) {
  if (looksLikeHtml(text)) return null;
  if (/define\s*\(\s*['"]DB_(NAME|USER|PASSWORD|HOST)['"]/i.test(text)) return 'wp-config';
  if (/\$table_prefix\s*=\s*['"]/.test(text)) return 'wp-config';
  return null;
}

function serverStatusSignature(text) {
  if (/Apache Server Status/i.test(text)) return 'server-status';
  return null;
}

function phpinfoSignature(text) {
  if (/<title>\s*phpinfo\(\)\s*<\/title>/i.test(text)) return 'phpinfo';
  if (/PHP Version/i.test(text) && /phpinfo\(\)/i.test(text)) return 'phpinfo';
  return null;
}

/**
 * @param {string} path - one of PROBE_PATHS
 * @param {string} body
 * @returns {string|null} signature id, or null when the body is not a real exposure
 */
function matchProbeSignature(path, body) {
  const text = (typeof body === 'string' ? body : '').slice(0, SIGNATURE_SAMPLE_CHARS);
  if (!text.trim()) return null;
  switch (path) {
    case '/.env':
      return envSignature(text);
    case '/.git/HEAD':
      return gitHeadSignature(text);
    case '/wp-config.php':
      return wpConfigSignature(text);
    case '/server-status':
      return serverStatusSignature(text);
    case '/phpinfo.php':
      return phpinfoSignature(text);
    default:
      return null;
  }
}

function closedProbe(path, url, extra) {
  return {
    path,
    url,
    finalUrl: extra.finalUrl ?? null,
    statusCode: extra.statusCode ?? null,
    exposed: false,
    signature: null,
    ...(extra.offHost ? { offHost: true } : {}),
    ...(extra.error ? { error: extra.error } : {}),
  };
}

/**
 * Probe the five sensitive paths on `origin`. Caller supplies the locked crawl host.
 * Delay sits between GETs so this does not burst harder than the HTML crawl.
 * @param {string} origin
 * @param {{ host?: string, fetchImpl?: typeof safeFetch, delayMs?: number, sleepFn?: (ms: number) => Promise<void> }} [options]
 */
async function runSecurityProbes(origin, options = {}) {
  const fetchImpl = options.fetchImpl || safeFetch;
  const delayMs = typeof options.delayMs === 'number' ? options.delayMs : 200;
  const sleepFn =
    options.sleepFn ||
    ((ms) =>
      new Promise((resolve) => {
        setTimeout(resolve, ms);
      }));
  const expectedHost = options.host
    ? hostnameOf(`http://${options.host}`) || options.host.toLowerCase()
    : null;
  const probes = [];

  for (const path of PROBE_PATHS) {
    if (delayMs > 0) {
      // eslint-disable-next-line no-await-in-loop
      await sleepFn(delayMs);
    }
    const url = `${origin}${path}`;
    let res;
    try {
      // eslint-disable-next-line no-await-in-loop
      res = await fetchImpl(url);
    } catch (err) {
      probes.push(
        closedProbe(path, url, {
          error: String(err?.message || 'Fetch failed').slice(0, 200),
        }),
      );
      continue; // eslint-disable-line no-continue
    }

    const finalUrl = res?.finalUrl || url;
    const finalHost = hostnameOf(finalUrl);
    if (expectedHost && finalHost && finalHost !== expectedHost) {
      probes.push(
        closedProbe(path, url, {
          finalUrl,
          statusCode: res?.statusCode ?? null,
          offHost: true,
        }),
      );
      continue; // eslint-disable-line no-continue
    }

    const statusCode = res?.statusCode ?? null;
    // 401/403/404 (and every other non-200) are not exposure, even if the body quotes a signature.
    if (statusCode !== 200) {
      probes.push(closedProbe(path, url, { finalUrl, statusCode }));
      continue; // eslint-disable-line no-continue
    }

    const signature = matchProbeSignature(path, res?.body);
    probes.push({
      path,
      url,
      finalUrl,
      statusCode,
      exposed: !!signature,
      signature,
    });
  }

  return probes;
}

module.exports = {
  PROBE_PATHS,
  matchProbeSignature,
  runSecurityProbes,
};

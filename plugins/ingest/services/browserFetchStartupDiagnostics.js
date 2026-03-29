// plugins/ingest/services/browserFetchStartupDiagnostics.js
// One-shot console checks when INGEST_BROWSER_FETCH is enabled (env, cache dir, Chrome, memory, network).
const fs = require('fs');
const https = require('https');
const os = require('os');

const { browserFetchEnabled } = require('./fetchSourceBrowserFetch');

/**
 * @returns {Promise<void>}
 */
async function runBrowserFetchStartupDiagnostics() {
  if (!browserFetchEnabled()) {
    return;
  }

  const p = (...args) => console.log('[ingest:browser_fetch]', ...args);

  p('startup diagnostics (INGEST_BROWSER_FETCH is on)');
  p('INGEST_BROWSER_FETCH (process.env):', JSON.stringify(process.env.INGEST_BROWSER_FETCH));
  p('PUPPETEER_CACHE_DIR:', process.env.PUPPETEER_CACHE_DIR || '(unset)');

  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch (err) {
    p('puppeteer require failed:', err?.message || err);
    return;
  }

  let execPath;
  try {
    execPath = puppeteer.executablePath();
  } catch (err) {
    p(
      'puppeteer.executablePath() failed (install Chrome: npm run puppeteer:install-chrome):',
      err?.message || err,
    );
    return;
  }

  p('Chrome executable:', execPath);

  if (!fs.existsSync(execPath)) {
    p('Chrome binary: path does not exist');
    return;
  }

  try {
    fs.accessSync(execPath, fs.constants.R_OK | fs.constants.X_OK);
    p('Chrome binary: readable + executable OK');
  } catch (err) {
    p('Chrome binary: access check failed:', err?.message || err);
  }

  const freeMiB = Math.round(os.freemem() / 1024 / 1024);
  const totalMiB = Math.round(os.totalmem() / 1024 / 1024);
  p('memory free/total MiB:', `${freeMiB} / ${totalMiB}`);

  await new Promise((resolve) => {
    const req = https.get('https://example.com', { timeout: 5000 }, (res) => {
      res.resume();
      p('network probe (HTTPS example.com): HTTP', res.statusCode);
      resolve();
    });
    req.on('error', (err) => {
      p('network probe failed:', err?.message || err);
      resolve();
    });
    req.on('timeout', () => {
      req.destroy();
      p('network probe: timeout (5s)');
      resolve();
    });
  });
}

module.exports = { runBrowserFetchStartupDiagnostics };

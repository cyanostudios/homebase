// Hardened Puppeteer PDF generation: block network after setContent.

const puppeteer = require('puppeteer');

/**
 * Launch Chromium for invoice/estimate PDF. Prefer project `.cache/puppeteer`
 * (see server/index.ts PUPPETEER_CACHE_DIR override).
 * @returns {Promise<import('puppeteer').Browser>}
 */
async function launchPdfBrowser() {
  const launchOpts = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  };
  try {
    launchOpts.executablePath = puppeteer.executablePath();
  } catch {
    // executablePath() throws when Chrome is missing; launch() will too with a clearer path.
  }
  return puppeteer.launch(launchOpts);
}

/**
 * Map Puppeteer/Chrome failures to a safe API error payload.
 * @param {unknown} error
 * @returns {{ status: number, error: string }}
 */
function pdfGenerationHttpError(error) {
  const msg = String((error && /** @type {{ message?: string }} */ (error).message) || '');
  if (/Could not find Chrome|Failed to launch the browser|Chrome for Testing/i.test(msg)) {
    return {
      status: 503,
      error:
        'PDF engine unavailable (Chrome missing). On this machine run: npm run puppeteer:install-chrome',
    };
  }
  return { status: 500, error: 'Failed to generate PDF' };
}

/**
 * @param {import('puppeteer').Page} page
 */
async function blockExternalNetwork(page) {
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    const url = request.url();
    if (url.startsWith('data:') || url === 'about:blank') {
      request.continue();
      return;
    }
    request.abort();
  });
}

/**
 * @param {import('puppeteer').Page} page
 * @param {string} html
 */
async function setPdfHtmlContent(page, html) {
  await blockExternalNetwork(page);
  await page.setContent(html, { waitUntil: 'load', timeout: 30000 });
}

/**
 * Repeating page label for every PDF page (Chromium print classes).
 * Top margin must clear this so continuation pages keep space above content.
 */
function invoicePdfPageHeaderTemplate() {
  return `<div style="width:100%;box-sizing:border-box;padding:4mm 10mm 0 10mm;font-size:10px;font-family:Helvetica,Arial,sans-serif;color:#64748b;text-align:right;line-height:1.2;">
  <span class="pageNumber"></span> / <span class="totalPages"></span>
</div>`;
}

/** Shared A4 print options for invoice PDFs. */
function invoicePdfPrintOptions() {
  return {
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: invoicePdfPageHeaderTemplate(),
    // Puppeteer requires a footer template when headers are enabled.
    footerTemplate: '<div></div>',
    // Top margin clears the repeating page label on page 2+.
    margin: { top: '14mm', right: '10mm', bottom: '12mm', left: '10mm' },
  };
}

/**
 * Render invoice HTML to PDF with per-page `X / Y` labels.
 *
 * @param {import('puppeteer').Page} page
 * @param {string} html
 */
async function renderInvoicePdf(page, html) {
  await setPdfHtmlContent(page, html);
  return page.pdf(invoicePdfPrintOptions());
}

module.exports = {
  launchPdfBrowser,
  pdfGenerationHttpError,
  blockExternalNetwork,
  setPdfHtmlContent,
  invoicePdfPrintOptions,
  invoicePdfPageHeaderTemplate,
  renderInvoicePdf,
};

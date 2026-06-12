// Hardened Puppeteer PDF generation: block network after setContent.

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

module.exports = { blockExternalNetwork, setPdfHtmlContent };

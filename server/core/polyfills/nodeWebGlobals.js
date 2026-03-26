/**
 * Cheerio (used by plugins/cups scraper) pulls undici, which expects `globalThis.File`
 * (standard in Node 20+). On Node 18 the cups plugin would fail to load → /api/cups 404.
 */
function applyNodeWebGlobalsPolyfill() {
  if (typeof globalThis.File !== 'undefined') {
    return;
  }
  const { Blob } = require('buffer');
  globalThis.File = class File extends Blob {
    constructor(fileBits, fileName, options) {
      super(fileBits, options);
      Object.defineProperty(this, 'name', {
        value: String(fileName),
        enumerable: true,
      });
    }
  };
}

module.exports = { applyNodeWebGlobalsPolyfill };

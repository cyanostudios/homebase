/**
 * Some HTTP/HTML stacks pull undici, which expects `globalThis.File` (standard in Node 20+).
 * On Node 18, polyfill File when missing so those code paths can load.
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

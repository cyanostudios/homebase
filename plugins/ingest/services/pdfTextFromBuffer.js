// plugins/ingest/services/pdfTextFromBuffer.js
// Shared PDF → plain text for ingest fetch paths (generic HTTP and browser).

const MAX_PDF_TEXT_CHARS = 4 * 1024 * 1024;

/**
 * @param {Buffer} buf
 */
function bufferLooksLikePdf(buf) {
  if (!buf || buf.length < 5) {
    return false;
  }
  return buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46;
}

/**
 * @param {string|null|undefined} contentType
 */
function isPdfContentType(contentType) {
  if (!contentType || typeof contentType !== 'string') {
    return false;
  }
  const base = contentType.split(';')[0].trim().toLowerCase();
  return base === 'application/pdf' || base === 'application/x-pdf';
}

/**
 * @param {Buffer} buf
 * @returns {Promise<string>}
 */
async function pdfTextFromBuffer(buf) {
  const pdfParse = require('pdf-parse');
  const data = await pdfParse(buf);
  let text = typeof data.text === 'string' ? data.text : '';
  text = text.replace(/\u0000/g, '').trim();
  if (text.length > MAX_PDF_TEXT_CHARS) {
    return `${text.slice(0, MAX_PDF_TEXT_CHARS)}\n…`;
  }
  return text;
}

module.exports = {
  bufferLooksLikePdf,
  isPdfContentType,
  pdfTextFromBuffer,
};

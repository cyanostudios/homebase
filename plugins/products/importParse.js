const XLSX = require('xlsx');
const csvParser = require('csv-parser');
const { Readable } = require('stream');

const IMPORT_MAX_ROWS = 5000;

function normalizeHeader(h) {
  return String(h || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[_-]+/g, '')
    .replace(/[^a-z0-9.]+/g, '');
}

async function parseCsvBuffer(buffer) {
  return await new Promise((resolve, reject) => {
    const rows = [];
    const stream = Readable.from(buffer);

    stream
      .pipe(
        csvParser({
          mapHeaders: ({ header }) => normalizeHeader(header),
          skipLines: 0,
          strict: false,
        }),
      )
      .on('data', (row) => {
        rows.push(row);
        if (rows.length > IMPORT_MAX_ROWS) {
          stream.destroy(new Error(`Too many rows (max ${IMPORT_MAX_ROWS})`));
        }
      })
      .on('error', (err) => reject(err))
      .on('end', () => resolve(rows));
  });
}

function parseXlsxBuffer(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = wb.SheetNames?.[0];
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  if (!Array.isArray(json)) return [];

  return json.map((row) => {
    const out = {};
    for (const [k, v] of Object.entries(row || {})) {
      out[normalizeHeader(k)] = v;
    }
    return out;
  });
}

function isCsvFile(mimetype, originalName) {
  const lower = String(originalName || '').toLowerCase();
  return mimetype === 'text/csv' || mimetype === 'application/csv' || lower.endsWith('.csv');
}

module.exports = {
  IMPORT_MAX_ROWS,
  normalizeHeader,
  parseCsvBuffer,
  parseXlsxBuffer,
  isCsvFile,
};

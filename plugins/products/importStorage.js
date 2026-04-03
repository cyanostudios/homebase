// Persists uploaded import files on disk (tenant DB is already isolated per schema).

const fs = require('fs/promises');
const path = require('path');

const UPLOAD_ROOT = path.join(process.cwd(), 'server', 'uploads', 'product-imports');

async function ensureDir() {
  await fs.mkdir(UPLOAD_ROOT, { recursive: true });
}

/** Safe filename extension: .csv or .xlsx */
function pickExt(originalName, mimetype) {
  const lower = String(originalName || '').toLowerCase();
  if (lower.endsWith('.xlsx')) return '.xlsx';
  if (lower.endsWith('.csv')) return '.csv';
  if (String(mimetype || '').includes('spreadsheet')) return '.xlsx';
  return '.csv';
}

/**
 * @param {string} jobId UUID
 * @param {Buffer} buffer
 * @param {string} originalName
 * @returns {Promise<string>} absolute path written
 */
async function writeJobFile(jobId, buffer, originalName) {
  await ensureDir();
  const safeId = String(jobId).replace(/[^a-f0-9-]/gi, '');
  const ext = pickExt(originalName, '');
  const abs = path.join(UPLOAD_ROOT, `${safeId}${ext}`);
  await fs.writeFile(abs, buffer);
  return abs;
}

async function readJobFile(absPath) {
  if (!absPath || typeof absPath !== 'string') {
    throw new Error('Missing path');
  }
  return fs.readFile(absPath);
}

async function unlinkQuiet(absPath) {
  if (!absPath || typeof absPath !== 'string') return;
  try {
    await fs.unlink(absPath);
  } catch {
    // ignore missing file
  }
}

module.exports = {
  UPLOAD_ROOT,
  writeJobFile,
  readJobFile,
  unlinkQuiet,
  pickExt,
};

const XLSX = require('xlsx');

const file = process.argv[2];
if (!file) {
  console.error('Usage: node tmp/inspect-xlsx.js <path-to-xlsx> [sheetName]');
  process.exit(2);
}

const wb = XLSX.readFile(file);
const sheetName = process.argv[3] || wb.SheetNames[0];
const sheet = wb.Sheets[sheetName];
if (!sheet) {
  console.error(`Sheet not found: ${sheetName}`);
  console.error('Available sheets:', wb.SheetNames);
  process.exit(3);
}

const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
const headers = rows[0] ? Object.keys(rows[0]) : [];

console.log(JSON.stringify({
  file,
  sheets: wb.SheetNames,
  sheetName,
  rowCount: rows.length,
  headers,
  sampleRows: rows.slice(0, 5),
}, null, 2));


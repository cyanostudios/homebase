const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'docs', 'SELLO_CHANNEL_FIELD_MAPPING.md');
let md = fs.readFileSync(filePath, 'utf8');

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const tableStart = md.indexOf('| Egenskap / parameter                                    | Sello');
const tableEnd = md.indexOf('| `products.created_at`, `products.updated_at`');
if (tableStart === -1 || tableEnd === -1) {
  console.error('Table not found', { tableStart, tableEnd });
  process.exit(1);
}
const tableEndLine = md.indexOf('\n', tableEnd);
const before = md.slice(0, tableStart);
const after = md.slice(tableEndLine + 1);
const tableBlock = md.slice(tableStart, tableEndLine + 1);

const lines = tableBlock.split('\n').filter((l) => l.trim().startsWith('|'));
const rows = lines.map((line) => {
  const parts = line.split('|').map((s) => s.trim());
  return parts.slice(1, 8);
});

const header = rows[0];
const dataRows = rows.slice(2);

let html = '<div style="overflow-x: auto;">\n';
html +=
  '<table style="width: max-content; border-collapse: collapse; font-size: 0.9em;">\n<thead>\n<tr>';
header.forEach((h) => {
  html +=
    '<th style="border: 1px solid #ccc; padding: 6px 8px; text-align: left; white-space: nowrap;">' +
    escapeHtml(h) +
    '</th>';
});
html += '</tr>\n</thead>\n<tbody>\n';

dataRows.forEach((cells) => {
  html += '<tr>';
  cells.forEach((c) => {
    html +=
      '<td style="border: 1px solid #ccc; padding: 6px 8px; vertical-align: top;">' +
      escapeHtml(c) +
      '</td>';
  });
  html += '</tr>\n';
});
html += '</tbody>\n</table>\n</div>';

const newMd = before + html + '\n\n' + after;
fs.writeFileSync(filePath, newMd);
console.log('Done: table converted to HTML with overflow-x: auto');

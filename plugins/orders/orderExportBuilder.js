// plugins/orders/orderExportBuilder.js
// Two-sheet Excel: order-level rows + line-level rows (same column vocabulary as bokföring).

const XLSX = require('xlsx');
const { HEADERS, buildAccountingRows } = require('./accountingExportBuilder');

/** Order-level columns (not line items). Same labels as bokföringsexporten. */
const ORDER_HEADERS = [
  'Marknadsplats',
  'Marknadsplatsens ordernummer',
  'Homebase ordernummer',
  'Status',
  'Kundens namn',
  'Kundens adress',
  'Kundens adress 2',
  'Kundens postnummer',
  'Kundens stad',
  'Kundens land',
  'Kundens e-mail',
  'Kundens telefon',
  'Skapad',
  'Valuta',
  'Betalningsmetod',
  'Betalningsreferens',
];

/** Line-level columns (ordered items). */
const LINE_HEADERS = [
  'Butikens artikelnummer',
  'Homebase artikelnummer',
  'Egen referens (SKU)',
  'Titel',
  'Private name',
  'Inköpspris',
  'Antal',
  'Pris/st',
  'Frakt',
  'Total inkl moms',
  'Total inkl moms och frakt',
  'Lagerplats',
  'Marknadsplatsens rad-referens',
  'Moms 25.00%',
  'Moms 12.00%',
];

const ORDER_SET = new Set(ORDER_HEADERS);
const LINE_SET = new Set(LINE_HEADERS);
const HB = 'Homebase ordernummer';

function isValidOrderFieldId(id) {
  return typeof id === 'string' && ORDER_SET.has(id);
}

function isValidLineFieldId(id) {
  return typeof id === 'string' && LINE_SET.has(id);
}

/**
 * Selected ids from client; Homebase ordernummer is always included for sorting/export.
 * Output column order follows global HEADERS / bokföring order.
 */
function resolveOrderColumns(selectedIds) {
  const set = new Set(Array.isArray(selectedIds) ? selectedIds.filter(isValidOrderFieldId) : []);
  set.add(HB);
  return HEADERS.filter((h) => set.has(h));
}

function resolveLineColumns(selectedIds) {
  const set = new Set(Array.isArray(selectedIds) ? selectedIds.filter(isValidLineFieldId) : []);
  set.add(HB);
  return HEADERS.filter((h) => set.has(h));
}

function pickRow(row, columns) {
  const o = {};
  for (const h of columns) {
    o[h] = row[h] !== undefined && row[h] !== null ? row[h] : '';
  }
  return o;
}

/** One row per order; input rows are in Homebase ordernummer order (first line per order kept). */
function dedupeOrderRows(accountingRows) {
  const seen = new Set();
  const out = [];
  for (const row of accountingRows) {
    const hb = row[HB];
    const key =
      hb !== '' && hb != null && String(hb).trim() !== ''
        ? `hb:${String(hb).trim()}`
        : `mk:${String(row['Marknadsplatsens ordernummer'] ?? '')}:${String(row['Marknadsplats'] ?? '')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

/**
 * @param {object[]} flatRows - from OrdersModel.getOrderExportFlatRowsByDateRange
 * @param {Record<string, string>|null} channelLabels
 * @param {string[]} orderFieldIds - requested order column ids (HB added server-side)
 * @param {string[]} lineFieldIds - requested line column ids (HB added server-side)
 */
function buildCustomOrderExportXlsx(flatRows, channelLabels, orderFieldIds, lineFieldIds) {
  const accountingRows = buildAccountingRows(flatRows, channelLabels);
  const orderCols = resolveOrderColumns(orderFieldIds);
  const lineCols = resolveLineColumns(lineFieldIds);

  const orderRowsFull = dedupeOrderRows(accountingRows);
  const orderOut = orderRowsFull.map((r) => pickRow(r, orderCols));
  const lineOut = accountingRows.map((r) => pickRow(r, lineCols));

  const wb = XLSX.utils.book_new();

  const wsOrder =
    orderOut.length === 0
      ? XLSX.utils.aoa_to_sheet([orderCols])
      : XLSX.utils.json_to_sheet(orderOut, { header: orderCols });
  XLSX.utils.book_append_sheet(wb, wsOrder, 'Order');

  const wsLines =
    lineOut.length === 0
      ? XLSX.utils.aoa_to_sheet([lineCols])
      : XLSX.utils.json_to_sheet(lineOut, { header: lineCols });
  XLSX.utils.book_append_sheet(wb, wsLines, 'Rader');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = {
  ORDER_HEADERS,
  LINE_HEADERS,
  ORDER_SET,
  LINE_SET,
  HB,
  isValidOrderFieldId,
  isValidLineFieldId,
  resolveOrderColumns,
  resolveLineColumns,
  buildCustomOrderExportXlsx,
};

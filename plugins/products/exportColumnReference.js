/**
 * Export column metadata for product Excel export (no Sello legacy, no issello).
 * @typedef {{ id: string; label: string; description: string; group: string }} ExportColumnDef
 */

/** @type {ExportColumnDef[]} */
const EXPORT_GENERAL_COLUMNS = [
  { id: 'id', label: 'ID', description: 'Homebase produkt-id', group: 'Grunddata' },
  { id: 'sku', label: 'SKU', description: 'Artikelnummer', group: 'Grunddata' },
  { id: 'mpn', label: 'MPN', description: 'Tillverkarens artikelnummer', group: 'Grunddata' },
  { id: 'privateName', label: 'Internt namn', description: 'Internt namn', group: 'Grunddata' },
  { id: 'title', label: 'Titel', description: 'Huvudtitel (fallback)', group: 'Texter' },
  {
    id: 'description',
    label: 'Beskrivning',
    description: 'Huvudbeskrivning (fallback)',
    group: 'Texter',
  },
  { id: 'status', label: 'Status', description: 'for sale eller paused', group: 'Grunddata' },
  { id: 'quantity', label: 'Lager', description: 'Antal i lager', group: 'Pris och lager' },
  { id: 'priceAmount', label: 'Pris', description: 'Katalogpris', group: 'Pris och lager' },
  { id: 'purchasePrice', label: 'Inköpspris', description: 'Inköpspris', group: 'Pris och lager' },
  { id: 'currency', label: 'Valuta', description: 'Valutakod', group: 'Pris och lager' },
  { id: 'vatRate', label: 'Momssats', description: 'Procent', group: 'Pris och lager' },
  { id: 'brand', label: 'Varumärke', description: 'Varumärke (namn)', group: 'Grunddata' },
  { id: 'brandId', label: 'Varumärkes-id', description: 'Varumärke id', group: 'Grunddata' },
  { id: 'ean', label: 'EAN', description: 'EAN', group: 'Identifierare' },
  { id: 'gtin', label: 'GTIN', description: 'GTIN', group: 'Identifierare' },
  { id: 'knNumber', label: 'KN-nummer', description: 'KN-nummer', group: 'Grunddata' },
  { id: 'supplierName', label: 'Leverantör', description: 'Leverantörsnamn', group: 'Grunddata' },
  { id: 'supplierId', label: 'Leverantörs-id', description: 'Leverantör id', group: 'Grunddata' },
  {
    id: 'manufacturerName',
    label: 'Tillverkare',
    description: 'Tillverkarnamn',
    group: 'Grunddata',
  },
  {
    id: 'manufacturerId',
    label: 'Tillverkar-id',
    description: 'Tillverkare id',
    group: 'Grunddata',
  },
  { id: 'lagerplats', label: 'Lagerplats', description: 'Lagerplats', group: 'Grunddata' },
  { id: 'condition', label: 'Skick', description: 'new | used | refurb', group: 'Grunddata' },
  { id: 'listId', label: 'List-id', description: 'Homebase list-id', group: 'Lista' },
  { id: 'listName', label: 'Listnamn', description: 'Namn på lista', group: 'Lista' },
  { id: 'groupId', label: 'Grupp-id', description: 'Variantgrupp', group: 'Grunddata' },
  {
    id: 'parentProductId',
    label: 'Förälder-produkt-id',
    description: 'För variant',
    group: 'Grunddata',
  },
  { id: 'color', label: 'Färg', description: 'Färg', group: 'Attribut' },
  { id: 'colorText', label: 'Färg (text)', description: 'Färg fritext', group: 'Attribut' },
  { id: 'size', label: 'Storlek', description: 'Storlek', group: 'Attribut' },
  { id: 'sizeText', label: 'Storlek (text)', description: 'Storlek fritext', group: 'Attribut' },
  { id: 'pattern', label: 'Mönster', description: 'Mönster', group: 'Attribut' },
  { id: 'material', label: 'Material', description: 'Material', group: 'Attribut' },
  { id: 'patternText', label: 'Mönster (text)', description: 'Mönster fritext', group: 'Attribut' },
  { id: 'model', label: 'Modell', description: 'Modell', group: 'Attribut' },
  { id: 'weight', label: 'Vikt', description: 'Vikt', group: 'Mått' },
  { id: 'lengthCm', label: 'Längd cm', description: 'Längd', group: 'Mått' },
  { id: 'widthCm', label: 'Bredd cm', description: 'Bredd', group: 'Mått' },
  { id: 'heightCm', label: 'Höjd cm', description: 'Höjd', group: 'Mått' },
  { id: 'depthCm', label: 'Djup cm', description: 'Djup', group: 'Mått' },
  { id: 'volume', label: 'Volym', description: 'Volym', group: 'Mått' },
  { id: 'volumeUnit', label: 'Volymenhet', description: 'Volymenhet', group: 'Mått' },
  { id: 'notes', label: 'Anteckningar', description: 'Anteckningar', group: 'Övrigt' },
  { id: 'mainImage', label: 'Huvudbild URL', description: 'Huvudbild', group: 'Media' },
  { id: 'images', label: 'Bilder', description: 'JSON-array / URL:er', group: 'Media' },
  { id: 'categories', label: 'Kategorier', description: 'JSON-array', group: 'Övrigt' },
  { id: 'quantitySold', label: 'Sålda (antal)', description: 'Historik', group: 'Övrigt' },
  { id: 'lastSoldAt', label: 'Senast såld', description: 'Tidstämpel', group: 'Övrigt' },
  { id: 'createdAt', label: 'Skapad', description: 'Tidstämpel', group: 'Övrigt' },
  { id: 'updatedAt', label: 'Uppdaterad', description: 'Tidstämpel', group: 'Övrigt' },
  {
    id: 'titleSe',
    label: 'Titel SE',
    description: 'textsExtended.se / titel',
    group: 'Texter per marknad',
  },
  {
    id: 'descriptionSe',
    label: 'Beskrivning SE',
    description: 'textsExtended.se',
    group: 'Texter per marknad',
  },
  {
    id: 'titleDk',
    label: 'Titel DK',
    description: 'textsExtended.dk',
    group: 'Texter per marknad',
  },
  {
    id: 'descriptionDk',
    label: 'Beskrivning DK',
    description: 'textsExtended.dk',
    group: 'Texter per marknad',
  },
  {
    id: 'titleFi',
    label: 'Titel FI',
    description: 'textsExtended.fi',
    group: 'Texter per marknad',
  },
  {
    id: 'descriptionFi',
    label: 'Beskrivning FI',
    description: 'textsExtended.fi',
    group: 'Texter per marknad',
  },
  {
    id: 'titleNo',
    label: 'Titel NO',
    description: 'textsExtended.no',
    group: 'Texter per marknad',
  },
  {
    id: 'descriptionNo',
    label: 'Beskrivning NO',
    description: 'textsExtended.no',
    group: 'Texter per marknad',
  },
  {
    id: 'textsStandard',
    label: 'Standard marknad (texter)',
    description: 'textsStandard',
    group: 'Texter',
  },
  {
    id: 'channelSpecificJson',
    label: 'channelSpecific (JSON)',
    description: 'Hela channel_specific som JSON-sträng',
    group: 'Avancerat',
  },
];

/** Per-channel field keys (import-compatible header suffixes). */
const CHANNEL_FIELD_KEYS = ['price', 'active', 'category'];

/**
 * @param {{ id: string; channel: string; instanceKey: string; market?: string | null; label?: string | null; enabled?: boolean }} inst
 * @returns {{ headerKey: string; field: string; label: string }[]}
 */
function channelInstanceExportFields(inst) {
  const ch = String(inst.channel || '').toLowerCase();
  const id = String(inst.id || '').trim();
  const key = String(inst.instanceKey || '').trim();
  const base = ch === 'woocommerce' && id ? `${ch}.${id}` : key ? `${ch}.${key}` : ch;
  return CHANNEL_FIELD_KEYS.map((field) => ({
    headerKey: `${base}.${field}`,
    field,
    label: field === 'price' ? 'Pris' : field === 'active' ? 'Aktiv' : 'Kategori',
  }));
}

/**
 * @param {Array<{ id: string; channel: string; instanceKey: string; market?: string | null; label?: string | null; enabled?: boolean }>} instances
 */
function buildExportChannelColumnPayload(instances) {
  const list = Array.isArray(instances) ? instances : [];
  return list.map((inst) => ({
    instanceId: String(inst.id || '').trim(),
    channel: inst.channel,
    instanceKey: inst.instanceKey,
    market: inst.market ?? null,
    label: inst.label ?? null,
    enabled: inst.enabled !== false,
    fields: channelInstanceExportFields(inst),
  }));
}

/**
 * @param {Array<{ id: string; channel: string; instanceKey: string; market?: string | null; label?: string | null; enabled?: boolean }>} instances
 */
function buildExportColumnReferencePayload(instances) {
  const instRows = Array.isArray(instances) ? instances : [];
  return {
    general: EXPORT_GENERAL_COLUMNS,
    instances: instRows.map((i) => ({
      id: String(i.id || '').trim(),
      channel: i.channel,
      instanceKey: i.instanceKey,
      market: i.market ?? null,
      label: i.label ?? null,
      enabled: i.enabled !== false,
    })),
    channelColumns: buildExportChannelColumnPayload(instRows),
  };
}

function getExportGeneralColumnIdsSet() {
  return new Set(EXPORT_GENERAL_COLUMNS.map((c) => c.id));
}

/**
 * All dynamic channel header keys for validation (from instances snapshot).
 * @param {Array<{ fields: { headerKey: string }[] }>} channelColumnsPayload
 */
function getExportChannelHeaderKeysSet(channelColumnsPayload) {
  const s = new Set();
  const rows = Array.isArray(channelColumnsPayload) ? channelColumnsPayload : [];
  for (const row of rows) {
    for (const f of row.fields || []) {
      if (f.headerKey) s.add(f.headerKey);
    }
  }
  return s;
}

module.exports = {
  EXPORT_GENERAL_COLUMNS,
  CHANNEL_FIELD_KEYS,
  buildExportColumnReferencePayload,
  buildExportChannelColumnPayload,
  channelInstanceExportFields,
  getExportGeneralColumnIdsSet,
  getExportChannelHeaderKeysSet,
};

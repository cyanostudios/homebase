/**
 * Build Excel rows for product export and serialize channel_specific / overrides.
 */

const XLSX = require('xlsx');
const { normalizeProductImages, getAssetOriginalUrl } = require('./productImageAssets');

const MAX_EXPORT_ROWS = 50000;

/**
 * @param {string} headerKey e.g. woocommerce.11.price or cdon.se.price
 * @returns {{ channel: string; segment: string; field: string } | null}
 */
function parseChannelHeaderKey(headerKey) {
  const s = String(headerKey || '').trim();
  const m = s.match(/^([a-z0-9]+)\.([a-z0-9]+)\.(price|active|category)$/i);
  if (!m) return null;
  return { channel: m[1].toLowerCase(), segment: m[2], field: m[3].toLowerCase() };
}

/**
 * @param {object | null} cs channelSpecific
 * @param {string} channel
 * @param {string} segment instance id (woo) or market key (cdon) or fyndiq key
 * @param {string} field
 */
function readChannelSpecificField(cs, channel, segment, field) {
  if (!cs || typeof cs !== 'object') return '';
  const ch = String(channel || '').toLowerCase();
  if (ch === 'woocommerce') {
    const w = cs.woocommerce;
    if (!w || typeof w !== 'object') return '';
    const inst = w[segment];
    if (!inst || typeof inst !== 'object') return '';
    if (field === 'price') {
      const v = inst.priceAmount ?? inst.price;
      return v != null && v !== '' ? String(v) : '';
    }
    if (field === 'active') {
      const v = inst.active;
      if (v === true || v === 1 || v === '1') return '1';
      if (v === false || v === 0 || v === '0') return '0';
      return '';
    }
    if (field === 'category') {
      const c = inst.category;
      if (Array.isArray(c)) return c.join(', ');
      return c != null ? String(c) : '';
    }
    return '';
  }
  if (ch === 'cdon') {
    const cdn = cs.cdon;
    if (!cdn || typeof cdn !== 'object') return '';
    const inst = cdn[segment];
    if (!inst || typeof inst !== 'object') return '';
    if (field === 'price') {
      const v = inst.priceAmount ?? inst.price;
      return v != null && v !== '' ? String(v) : '';
    }
    if (field === 'active') {
      const v = inst.active;
      if (v === true || v === 1 || v === '1') return '1';
      if (v === false || v === 0 || v === '0') return '0';
      return '';
    }
    if (field === 'category') {
      const c = inst.category;
      if (Array.isArray(c)) return c.join(', ');
      return c != null ? String(c) : '';
    }
    return '';
  }
  if (ch === 'fyndiq') {
    const fq = cs.fyndiq;
    if (!fq || typeof fq !== 'object') return '';
    const inst = fq[segment];
    if (!inst || typeof inst !== 'object') return '';
    if (field === 'price') {
      const v = inst.priceAmount ?? inst.price;
      return v != null && v !== '' ? String(v) : '';
    }
    if (field === 'active') {
      const v = inst.active;
      if (v === true || v === 1 || v === '1') return '1';
      if (v === false || v === 0 || v === '0') return '0';
      return '';
    }
    if (field === 'category') {
      const c = inst.category;
      if (Array.isArray(c)) return c.join(', ');
      return c != null ? String(c) : '';
    }
    return '';
  }
  return '';
}

/**
 * @param {object | null} ov row from channel_product_overrides
 * @param {string} field
 * @returns {string | null} null = use channel_specific fallback
 */
function formatOverrideField(ov, field) {
  if (!ov) return null;
  if (field === 'price') {
    if (ov.price_amount == null) return null;
    return String(ov.price_amount);
  }
  if (field === 'active') {
    if (ov.active === true) return '1';
    if (ov.active === false) return '0';
    return null;
  }
  if (field === 'category') {
    const c = ov.category;
    if (c == null || String(c).trim() === '') return null;
    return String(c);
  }
  return null;
}

/**
 * @param {Map<string, object>} overrideMap key productId:channelInstanceId
 */
function getChannelCellValue(product, headerKey, overrideMap, instanceIdNum) {
  const parsed = parseChannelHeaderKey(headerKey);
  if (!parsed) return '';
  const { channel, segment, field } = parsed;
  const pid = String(product.id || '');
  const okey = `${pid}:${instanceIdNum}`;
  const ov = overrideMap.get(okey);
  const fromOv = formatOverrideField(ov, field);
  if (fromOv != null) return fromOv;
  const cs = product.channelSpecific;
  return readChannelSpecificField(cs, channel, segment, field);
}

function getTextsExtended(product) {
  const cs = product.channelSpecific;
  if (!cs || typeof cs !== 'object') return {};
  const te = cs.textsExtended;
  if (!te || typeof te !== 'object') return {};
  return te;
}

function getMarketText(product, market, key) {
  const te = getTextsExtended(product);
  const m = te[market];
  if (!m || typeof m !== 'object') return '';
  if (key === 'title') return String(m.name ?? m.title ?? '').trim();
  if (key === 'description') return String(m.description ?? '').trim();
  return '';
}

function serializeImages(images) {
  const assets = normalizeProductImages(images);
  const urls = assets
    .map((a) => getAssetOriginalUrl(a))
    .filter((u) => typeof u === 'string' && u.trim() !== '');
  return urls.join(', ');
}

function serializeCategories(categories) {
  if (!Array.isArray(categories)) return '';
  try {
    return JSON.stringify(categories);
  } catch {
    return '';
  }
}

/**
 * @param {object} product transformed product row
 * @param {string} columnId
 */
function getGeneralCell(product, columnId) {
  switch (columnId) {
    case 'id':
      return product.id ?? '';
    case 'sku':
      return product.sku ?? '';
    case 'mpn':
      return product.mpn ?? '';
    case 'privateName':
      return product.privateName ?? '';
    case 'title':
      return product.title ?? '';
    case 'description':
      return product.description ?? '';
    case 'status':
      return product.status ?? '';
    case 'quantity':
      return product.quantity != null ? String(product.quantity) : '';
    case 'priceAmount':
      return product.priceAmount != null ? String(product.priceAmount) : '';
    case 'purchasePrice':
      return product.purchasePrice != null ? String(product.purchasePrice) : '';
    case 'currency':
      return product.currency ?? '';
    case 'vatRate':
      return product.vatRate != null ? String(product.vatRate) : '';
    case 'brand':
      return product.brand ?? '';
    case 'brandId':
      return product.brandId ?? '';
    case 'ean':
      return product.ean ?? '';
    case 'gtin':
      return product.gtin ?? '';
    case 'knNumber':
      return product.knNumber ?? '';
    case 'supplierName':
      return product.supplierName ?? '';
    case 'supplierId':
      return product.supplierId ?? '';
    case 'manufacturerName':
      return product.manufacturerName ?? '';
    case 'manufacturerId':
      return product.manufacturerId ?? '';
    case 'lagerplats':
      return product.lagerplats ?? '';
    case 'condition':
      return product.condition ?? '';
    case 'listId':
      return product.listId ?? '';
    case 'listName':
      return product.listName ?? '';
    case 'groupId':
      return product.groupId ?? '';
    case 'parentProductId':
      return product.parentProductId ?? '';
    case 'color':
      return product.color ?? '';
    case 'colorText':
      return product.colorText ?? '';
    case 'size':
      return product.size ?? '';
    case 'sizeText':
      return product.sizeText ?? '';
    case 'pattern':
      return product.pattern ?? '';
    case 'material':
      return product.material ?? '';
    case 'patternText':
      return product.patternText ?? '';
    case 'model':
      return product.model ?? '';
    case 'weight':
      return product.weight != null ? String(product.weight) : '';
    case 'lengthCm':
      return product.lengthCm != null ? String(product.lengthCm) : '';
    case 'widthCm':
      return product.widthCm != null ? String(product.widthCm) : '';
    case 'heightCm':
      return product.heightCm != null ? String(product.heightCm) : '';
    case 'depthCm':
      return product.depthCm != null ? String(product.depthCm) : '';
    case 'volume':
      return product.volume != null ? String(product.volume) : '';
    case 'volumeUnit':
      return product.volumeUnit ?? '';
    case 'notes':
      return product.notes ?? '';
    case 'mainImage':
      return product.mainImage ?? '';
    case 'images':
      return serializeImages(product.images);
    case 'categories':
      return serializeCategories(product.categories);
    case 'quantitySold':
      return product.quantitySold != null ? String(product.quantitySold) : '';
    case 'lastSoldAt':
      return product.lastSoldAt != null ? String(product.lastSoldAt) : '';
    case 'createdAt':
      return product.createdAt != null ? String(product.createdAt) : '';
    case 'updatedAt':
      return product.updatedAt != null ? String(product.updatedAt) : '';
    case 'titleSe':
      return getMarketText(product, 'se', 'title');
    case 'descriptionSe':
      return getMarketText(product, 'se', 'description');
    case 'titleDk':
      return getMarketText(product, 'dk', 'title');
    case 'descriptionDk':
      return getMarketText(product, 'dk', 'description');
    case 'titleFi':
      return getMarketText(product, 'fi', 'title');
    case 'descriptionFi':
      return getMarketText(product, 'fi', 'description');
    case 'titleNo':
      return getMarketText(product, 'no', 'title');
    case 'descriptionNo':
      return getMarketText(product, 'no', 'description');
    case 'textsStandard': {
      const cs = product.channelSpecific;
      if (!cs || typeof cs !== 'object') return '';
      return cs.textsStandard != null ? String(cs.textsStandard) : '';
    }
    case 'channelSpecificJson': {
      const cs = product.channelSpecific;
      if (!cs || typeof cs !== 'object') return '';
      try {
        return JSON.stringify(cs);
      } catch {
        return '';
      }
    }
    default:
      return '';
  }
}

/**
 * @param {{ kind: 'general'; id: string; header: string } | { kind: 'channel'; headerKey: string; header: string; instanceId: number }}[] resolvedColumns
 */
function buildSheetBuffer(products, resolvedColumns, overrideMap, sheetName = 'Produkter') {
  const headers = resolvedColumns.map((c) => c.header);
  const aoa = [headers];
  for (const p of products) {
    const row = resolvedColumns.map((col) => {
      if (col.kind === 'general') {
        return getGeneralCell(p, col.id);
      }
      return getChannelCellValue(p, col.headerKey, overrideMap, col.instanceId);
    });
    aoa.push(row);
  }
  return buildWorkbookFromAoA(aoa, sheetName);
}

function buildWorkbookFromAoA(aoa, sheetName = 'Produkter') {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = {
  MAX_EXPORT_ROWS,
  parseChannelHeaderKey,
  buildSheetBuffer,
  buildWorkbookFromAoA,
  getGeneralCell,
  getChannelCellValue,
};

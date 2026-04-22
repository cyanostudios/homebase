// plugins/products/catalogFilterSchema.js
// Whitelist validation + SQL fragments for product catalog filters (AND-only).

const { AppError } = require('../../server/core/errors/AppError');

const MAX_FILTERS = 20;
const MAX_IN = 200;
const MAX_STR = 500;

const STATUS = new Set(['for sale', 'paused']);
const CONDITION = new Set(['new', 'used', 'refurb']);
const CHANNEL_STATES = new Set(['active', 'inactive']);

/** @type {Set<string>} */
const FILTER_TYPES = new Set([
  'brand',
  'supplier',
  'manufacturer',
  'status',
  'condition',
  'quantity',
  'channelPrice',
  'lagerplats',
  'sku',
  'ean',
  'gtin',
  'channelState',
  'list',
]);

const OPS = {
  brand: new Set(['eq', 'in']),
  supplier: new Set(['eq', 'in']),
  manufacturer: new Set(['eq', 'in']),
  status: new Set(['in']),
  condition: new Set(['in']),
  quantity: new Set(['eq', 'gt', 'gte', 'lt', 'lte']),
  channelPrice: new Set(['eq', 'gt', 'gte', 'lt', 'lte']),
  lagerplats: new Set(['contains', 'eq']),
  sku: new Set(['contains', 'eq', 'prefix']),
  ean: new Set(['contains', 'eq', 'prefix']),
  gtin: new Set(['contains', 'eq', 'prefix']),
  channelState: new Set(['eq']),
  list: new Set(['eq']),
};

const QUICK_FILTER_TYPES = new Set([]);

/**
 * Public metadata for /filter-definitions and the client.
 */
function getFilterDefinitions() {
  return {
    version: 1,
    maxFilters: MAX_FILTERS,
    andOnly: true,
    quickFilterTypes: Array.from(QUICK_FILTER_TYPES),
    filterTypes: [
      { type: 'brand', quick: false, label: 'Varumärke', operators: ['eq', 'in'] },
      { type: 'supplier', quick: false, label: 'Leverantör', operators: ['eq', 'in'] },
      { type: 'manufacturer', quick: false, label: 'Tillverkare', operators: ['eq', 'in'] },
      { type: 'status', quick: false, label: 'Status', operators: ['in'] },
      { type: 'condition', quick: false, label: 'Skick', operators: ['in'] },
      {
        type: 'quantity',
        quick: false,
        label: 'Lagerantal',
        operators: ['eq', 'gt', 'gte', 'lt', 'lte'],
      },
      {
        type: 'channelPrice',
        quick: false,
        label: 'Pris (kanal)',
        operators: ['eq', 'gt', 'gte', 'lt', 'lte'],
      },
      { type: 'lagerplats', quick: false, label: 'Lagerplats', operators: ['contains', 'eq'] },
      { type: 'sku', quick: false, label: 'SKU', operators: ['contains', 'eq', 'prefix'] },
      { type: 'ean', quick: false, label: 'EAN', operators: ['contains', 'eq', 'prefix'] },
      { type: 'gtin', quick: false, label: 'GTIN', operators: ['contains', 'eq', 'prefix'] },
      { type: 'channelState', quick: false, label: 'Kanal', operators: ['eq'] },
      { type: 'list', quick: false, label: 'Lista', operators: ['eq'] },
    ],
  };
}

/**
 * @param {unknown} v
 * @returns {string|null}
 */
function trimString(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

/**
 * @param {unknown} v
 * @returns {number|null}
 */
function readPositiveInt(v) {
  const n = parseInt(String(v), 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return n;
}

/**
 * @param {unknown} v
 * @param {number} i
 * @param {string} label
 * @returns {number[]}
 */
function readIdArray(v, i, label) {
  if (!Array.isArray(v) || v.length === 0) {
    throw new AppError(
      `Invalid value for ${label} at filter index ${i}`,
      400,
      AppError.CODES.VALIDATION_ERROR,
    );
  }
  if (v.length > MAX_IN) {
    throw new AppError('Too many ids in filter', 400, AppError.CODES.VALIDATION_ERROR);
  }
  const out = [];
  for (const x of v) {
    const n = readPositiveInt(x);
    if (n == null) {
      throw new AppError(
        `Invalid id in ${label} at filter index ${i}`,
        400,
        AppError.CODES.VALIDATION_ERROR,
      );
    }
    out.push(n);
  }
  return out;
}

/**
 * @param {unknown} v
 * @param {string} colName
 * @param {number} i
 * @param {number} max
 * @returns {string}
 */
function readStringMax(v, colName, i, max) {
  const s = trimString(v);
  if (s == null) {
    throw new AppError(
      `Invalid ${colName} at filter index ${i}`,
      400,
      AppError.CODES.VALIDATION_ERROR,
    );
  }
  if (s.length > max) {
    throw new AppError(
      `Invalid ${colName} at filter index ${i}`,
      400,
      AppError.CODES.VALIDATION_ERROR,
    );
  }
  return s;
}

/**
 * @param {unknown} v
 * @param {number} i
 * @returns {number}
 */
function readNonNegNumber(v, i) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) {
    throw new AppError(`Invalid number at filter index ${i}`, 400, AppError.CODES.VALIDATION_ERROR);
  }
  return n;
}

/**
 * @param {unknown} raw
 * @returns {Array<{ type: string, op: string, value: unknown }>}
 */
function parseAndNormalizeFilters(raw) {
  if (raw == null) return [];
  if (!Array.isArray(raw)) {
    throw new AppError('filters must be an array', 400, AppError.CODES.VALIDATION_ERROR);
  }
  if (raw.length > MAX_FILTERS) {
    throw new AppError('Too many filters', 400, AppError.CODES.VALIDATION_ERROR);
  }

  const out = [];
  for (let i = 0; i < raw.length; i += 1) {
    const entry = raw[i];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new AppError(`Invalid filter at index ${i}`, 400, AppError.CODES.VALIDATION_ERROR);
    }
    const type = trimString(/** @type {any} */ (entry).type);
    const op = trimString(/** @type {any} */ (entry).op);
    if (!type || !FILTER_TYPES.has(type)) {
      throw new AppError(`Invalid filter type at index ${i}`, 400, AppError.CODES.VALIDATION_ERROR);
    }
    const allowed = OPS[type];
    if (!allowed || !op || !allowed.has(op)) {
      throw new AppError(
        `Invalid operator for filter at index ${i}`,
        400,
        AppError.CODES.VALIDATION_ERROR,
      );
    }
    const val = /** @type {any} */ (entry).value;
    out.push(validateValue(type, op, val, i));
  }
  return out;
}

/**
 * @param {string} type
 * @param {string} op
 * @param {unknown} val
 * @param {number} i
 */
function validateValue(type, op, val, i) {
  switch (type) {
    case 'brand': {
      if (op === 'eq') {
        const id = readPositiveInt(val);
        if (id == null) {
          throw new AppError('Invalid brand id', 400, AppError.CODES.VALIDATION_ERROR);
        }
        return { type, op, value: { id } };
      }
      const ids = readIdArray(val, i, 'brand');
      return { type, op, value: { ids } };
    }
    case 'supplier': {
      if (op === 'eq') {
        const id = readPositiveInt(val);
        if (id == null) {
          throw new AppError('Invalid supplier id', 400, AppError.CODES.VALIDATION_ERROR);
        }
        return { type, op, value: { id } };
      }
      const ids = readIdArray(val, i, 'supplier');
      return { type, op, value: { ids } };
    }
    case 'manufacturer': {
      if (op === 'eq') {
        const id = readPositiveInt(val);
        if (id == null) {
          throw new AppError('Invalid manufacturer id', 400, AppError.CODES.VALIDATION_ERROR);
        }
        return { type, op, value: { id } };
      }
      const ids = readIdArray(val, i, 'manufacturer');
      return { type, op, value: { ids } };
    }
    case 'status': {
      if (!Array.isArray(val) || val.length === 0) {
        throw new AppError('Invalid status list', 400, AppError.CODES.VALIDATION_ERROR);
      }
      if (val.length > MAX_IN) {
        throw new AppError('Invalid status list', 400, AppError.CODES.VALIDATION_ERROR);
      }
      const statuses = [];
      for (const s of val) {
        const t = trimString(s);
        if (!t || !STATUS.has(t)) {
          throw new AppError('Invalid status value', 400, AppError.CODES.VALIDATION_ERROR);
        }
        statuses.push(t);
      }
      return { type, op, value: { statuses: [...new Set(statuses)] } };
    }
    case 'condition': {
      if (!Array.isArray(val) || val.length === 0) {
        throw new AppError('Invalid condition list', 400, AppError.CODES.VALIDATION_ERROR);
      }
      if (val.length > MAX_IN) {
        throw new AppError('Invalid condition list', 400, AppError.CODES.VALIDATION_ERROR);
      }
      const conds = [];
      for (const s of val) {
        const t = trimString(s);
        if (!t || !CONDITION.has(t)) {
          throw new AppError('Invalid condition value', 400, AppError.CODES.VALIDATION_ERROR);
        }
        conds.push(t);
      }
      return { type, op, value: { conditions: [...new Set(conds)] } };
    }
    case 'quantity': {
      const n = readNonNegNumber(val, i);
      return { type, op, value: { n } };
    }
    case 'channelPrice': {
      if (val == null || typeof val !== 'object' || Array.isArray(val)) {
        throw new AppError('Invalid channelPrice value', 400, AppError.CODES.VALIDATION_ERROR);
      }
      const instanceId = readPositiveInt(/** @type {any} */ (val).instanceId);
      const n = readNonNegNumber(/** @type {any} */ (val).n, i);
      if (instanceId == null) {
        throw new AppError(
          'Invalid channel instance for price filter',
          400,
          AppError.CODES.VALIDATION_ERROR,
        );
      }
      return { type, op, value: { instanceId, n } };
    }
    case 'lagerplats': {
      if (op === 'eq') {
        const s = readStringMax(val, 'lagerplats', i, 100);
        return { type, op, value: { text: s } };
      }
      const s = readStringMax(val, 'lagerplats', i, MAX_STR);
      return { type, op, value: { text: s } };
    }
    case 'sku':
    case 'ean':
    case 'gtin': {
      const s = readStringMax(val, type, i, 255);
      return { type, op, value: { text: s } };
    }
    case 'list': {
      if (val == null || typeof val !== 'object' || Array.isArray(val)) {
        throw new AppError('Invalid list filter value', 400, AppError.CODES.VALIDATION_ERROR);
      }
      const mode = trimString(/** @type {any} */ (val).mode);
      if (mode === 'all' || mode === 'main') {
        return { type, op, value: { mode } };
      }
      if (mode === 'listId') {
        const listId = readPositiveInt(/** @type {any} */ (val).listId);
        if (listId == null) {
          throw new AppError('Invalid list id in filter', 400, AppError.CODES.VALIDATION_ERROR);
        }
        return { type, op, value: { mode, listId } };
      }
      throw new AppError('Invalid list filter value', 400, AppError.CODES.VALIDATION_ERROR);
    }
    case 'channelState': {
      if (val == null || typeof val !== 'object' || Array.isArray(val)) {
        throw new AppError('Invalid channelState value', 400, AppError.CODES.VALIDATION_ERROR);
      }
      const instanceId = readPositiveInt(/** @type {any} */ (val).instanceId);
      const state = trimString(/** @type {any} */ (val).state);
      if (instanceId == null || !state || !CHANNEL_STATES.has(state)) {
        throw new AppError('Invalid channelState value', 400, AppError.CODES.VALIDATION_ERROR);
      }
      return { type, op, value: { instanceId, state } };
    }
    default:
      throw new AppError('Unsupported filter', 400, AppError.CODES.VALIDATION_ERROR);
  }
}

const COL = {
  brand: 'p.brand_id',
  supplier: 'p.supplier_id',
  manufacturer: 'p.manufacturer_id',
  quantity: 'p.quantity',
  status: 'p.status',
  lagerplats: 'p.lagerplats',
  sku: 'p.sku',
  ean: 'p.ean',
  gtin: 'p.gtin',
  condition: 'p.condition',
};

/**
 * @param {Array<{ type: string, op: string, value: unknown }>} normalized
 * @param {unknown[]} params mutates; shared with caller's param list
 * @param {{ skipListType?: boolean }} [opts] when true, ignore type list (use top-level list)
 * @returns {string[]}
 */
function buildStructuredFilterClauses(normalized, params, opts = {}) {
  const skipListType = Boolean(opts.skipListType);
  const frags = [];
  for (const f of normalized) {
    if (f.type === 'list' && skipListType) {
      continue;
    }
    const frag = oneFilterSql(f, params);
    if (frag) frags.push(frag);
  }
  return frags;
}

/**
 * @param {{ type: string, op: string, value: any }} f
 * @param {unknown[]} params
 * @returns {string|null}
 */
function oneFilterSql(f, params) {
  const col = () => {
    if (f.type === 'brand') return COL.brand;
    if (f.type === 'supplier') return COL.supplier;
    if (f.type === 'manufacturer') return COL.manufacturer;
    if (f.type === 'status') return COL.status;
    if (f.type === 'condition') return COL.condition;
    if (f.type === 'quantity') return COL.quantity;
    if (f.type === 'lagerplats') return COL.lagerplats;
    if (f.type === 'sku') return COL.sku;
    if (f.type === 'ean') return COL.ean;
    if (f.type === 'gtin') return COL.gtin;
    return null;
  };

  if (f.type === 'brand' && f.op === 'eq') {
    const id = f.value.id;
    params.push(id);
    return `${col()} = $${params.length}`;
  }
  if (f.type === 'brand' && f.op === 'in') {
    params.push(f.value.ids);
    return `${col()} = ANY($${params.length}::int[])`;
  }
  if (f.type === 'supplier' && f.op === 'eq') {
    params.push(f.value.id);
    return `${col()} = $${params.length}`;
  }
  if (f.type === 'supplier' && f.op === 'in') {
    params.push(f.value.ids);
    return `${col()} = ANY($${params.length}::int[])`;
  }
  if (f.type === 'manufacturer' && f.op === 'eq') {
    params.push(f.value.id);
    return `${col()} = $${params.length}`;
  }
  if (f.type === 'manufacturer' && f.op === 'in') {
    params.push(f.value.ids);
    return `${col()} = ANY($${params.length}::int[])`;
  }
  if (f.type === 'status' && f.op === 'in') {
    params.push(f.value.statuses);
    return `${col()} = ANY($${params.length}::text[])`;
  }
  if (f.type === 'condition' && f.op === 'in') {
    params.push(f.value.conditions);
    return `${col()} = ANY($${params.length}::text[])`;
  }
  if (f.type === 'quantity' && f.op !== 'eq') {
    const map = { gt: '>', gte: '>=', lt: '<', lte: '<=' };
    const sym = map[f.op];
    params.push(f.value.n);
    return `${col()} ${sym} $${params.length}`;
  }
  if (f.type === 'quantity' && f.op === 'eq') {
    params.push(f.value.n);
    return `${col()} = $${params.length}`;
  }
  if (f.type === 'channelPrice' && f.op !== 'eq') {
    const map = { gt: '>', gte: '>=', lt: '<', lte: '<=' };
    const sym = map[f.op];
    params.push(f.value.instanceId);
    const iInst = params.length;
    params.push(f.value.n);
    const iN = params.length;
    return `EXISTS (
      SELECT 1 FROM channel_product_overrides cpo
      WHERE cpo.product_id = p.id::text
        AND cpo.channel_instance_id = $${iInst}
        AND cpo.price_amount IS NOT NULL
        AND cpo.price_amount ${sym} $${iN}
    )`;
  }
  if (f.type === 'channelPrice' && f.op === 'eq') {
    params.push(f.value.instanceId);
    const iInst = params.length;
    params.push(f.value.n);
    const iN = params.length;
    return `EXISTS (
      SELECT 1 FROM channel_product_overrides cpo
      WHERE cpo.product_id = p.id::text
        AND cpo.channel_instance_id = $${iInst}
        AND cpo.price_amount IS NOT NULL
        AND cpo.price_amount = $${iN}
    )`;
  }
  if (f.type === 'lagerplats' && f.op === 'eq') {
    const t = f.value.text.toLowerCase();
    params.push(t);
    return `lower(${col()}) = $${params.length}`;
  }
  if (f.type === 'lagerplats' && f.op === 'contains') {
    const t = f.value.text.toLowerCase();
    params.push(t);
    return `position($${params.length} in lower(COALESCE(${col()}::text, ''))) > 0`;
  }

  if (f.type === 'sku' || f.type === 'ean' || f.type === 'gtin') {
    const t = f.value.text;
    if (f.op === 'eq') {
      params.push(t);
      return `${col()} = $${params.length}`;
    }
    if (f.op === 'prefix') {
      const tl = t.toLowerCase();
      params.push(tl);
      return `starts_with(lower(${col()}::text), $${params.length}::text)`;
    }
    const tl = t.toLowerCase();
    params.push(tl);
    return `position($${params.length} in lower(${col()}::text)) > 0`;
  }

  if (f.type === 'list' && f.op === 'eq') {
    if (f.value.mode === 'all') {
      return 'TRUE';
    }
    if (f.value.mode === 'main') {
      return `NOT EXISTS (
        SELECT 1 FROM product_list_items pli0
        WHERE pli0.product_id = p.id
      )`;
    }
    if (f.value.mode === 'listId') {
      params.push(f.value.listId);
      return `EXISTS (
        SELECT 1 FROM product_list_items pli0
        WHERE pli0.product_id = p.id AND pli0.list_id = $${params.length}
      )`;
    }
  }

  if (f.type === 'channelState' && f.op === 'eq') {
    const { instanceId, state } = f.value;
    params.push(instanceId);
    const idx = params.length;
    const sub = `SELECT 1 FROM channel_product_map cpm
      WHERE cpm.product_id = p.id::text
        AND cpm.channel_instance_id = $${idx}`;
    // active = påslagen mot kanal; inactive = allt som inte är det (saknas rad / avstängd)
    if (state === 'active') {
      return `EXISTS (${sub} AND cpm.enabled = TRUE)`;
    }
    if (state === 'inactive') {
      return `NOT EXISTS (${sub} AND cpm.enabled = TRUE)`;
    }
  }

  return null;
}

module.exports = {
  MAX_FILTERS,
  getFilterDefinitions,
  parseAndNormalizeFilters,
  buildStructuredFilterClauses,
  QUICK_FILTER_TYPES,
  FILTER_TYPES,
};

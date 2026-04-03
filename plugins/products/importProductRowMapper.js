/**
 * Maps normalized import rows (keys from importParse.normalizeHeader) to product fields
 * and channelSpecific patches. Excludes variant grouping (groupId, parentProductId, etc.).
 */

const IMPORT_TEXT_MARKETS = ['se', 'dk', 'fi', 'no'];

/** Top-level keys allowed in channelSpecificJson (strict merge). */
const CHANNEL_SPECIFIC_JSON_ROOT_KEYS = new Set([
  'textsExtended',
  'textsStandard',
  'weightUnit',
  'cdon',
  'fyndiq',
  'woocommerce',
]);

function toIntOrUndef(v) {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  return Math.trunc(n);
}

function toFloatOrUndef(v) {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  return n;
}

function toStrOrUndef(v) {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s ? s : undefined;
}

function toPositiveIntOrUndef(v) {
  const n = toIntOrUndef(v);
  if (n === undefined || n < 1) return undefined;
  return n;
}

function importDescPlainNonEmpty(htmlOrText) {
  const s = String(htmlOrText ?? '').trim();
  if (!s) return false;
  return (
    s
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim().length > 0
  );
}

function normalizeImportTextsStandard(raw) {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (['se', 'dk', 'fi', 'no'].includes(s)) return s;
  return null;
}

function normalizeCondition(raw) {
  const c = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (c === 'new' || c === 'used' || c === 'refurb') return c;
  return undefined;
}

function parseCommaSeparatedStrings(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return undefined;
  const parts = String(raw)
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  return parts.length ? parts : undefined;
}

function parseBulletpointsToArray(raw) {
  if (raw === undefined || raw === null) return undefined;
  const s = String(raw).trim();
  if (!s) return undefined;
  const parts = s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  return parts.length ? parts : undefined;
}

/**
 * Deep-merge plain objects; non-objects replace. Arrays are replaced (not concatenated).
 * @param {object | null | undefined} base
 * @param {object | null | undefined} patch
 */
function deepMergeChannelSpecific(base, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return base && typeof base === 'object' && !Array.isArray(base) ? { ...base } : {};
  }
  const out = base && typeof base === 'object' && !Array.isArray(base) ? { ...base } : {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = deepMergeChannelSpecific(out[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function mergeTextsExtendedForImport(existing, patch) {
  const ex =
    existing && typeof existing === 'object' && !Array.isArray(existing) ? { ...existing } : {};
  for (const [mk, fields] of Object.entries(patch)) {
    if (!fields || typeof fields !== 'object') continue;
    ex[mk] = { ...(ex[mk] || {}), ...fields };
  }
  return ex;
}

/**
 * Per-market: title.*, description.*, titleSeo.*, metaDesc.*, metaKeywords.*, bulletpoints.*
 */
function buildTextsExtendedPatchFromImportRow(r) {
  const patch = {};
  for (const mk of IMPORT_TEXT_MARKETS) {
    const tk = `title.${mk}`;
    const dk = `description.${mk}`;
    const tSeo = `titleseo.${mk}`;
    const mDesc = `metadesc.${mk}`;
    const mKw = `metakeywords.${mk}`;
    const bp = `bulletpoints.${mk}`;

    const hasTk = Object.prototype.hasOwnProperty.call(r, tk);
    const hasDk = Object.prototype.hasOwnProperty.call(r, dk);
    const hasTSeo = Object.prototype.hasOwnProperty.call(r, tSeo);
    const hasMDesc = Object.prototype.hasOwnProperty.call(r, mDesc);
    const hasMKw = Object.prototype.hasOwnProperty.call(r, mKw);
    const hasBp = Object.prototype.hasOwnProperty.call(r, bp);

    if (!hasTk && !hasDk && !hasTSeo && !hasMDesc && !hasMKw && !hasBp) continue;

    const entry = {};

    if (hasTk) {
      const nameRaw = r[tk];
      if (nameRaw !== undefined && nameRaw !== null && String(nameRaw).trim() !== '') {
        entry.name = String(nameRaw).trim().slice(0, 255);
      }
    }
    if (hasDk) {
      const descRaw = r[dk];
      if (descRaw !== undefined && descRaw !== null && String(descRaw).trim() !== '') {
        entry.description = String(descRaw).trim();
      }
    }
    if (hasTSeo) {
      const v = r[tSeo];
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        entry.titleSeo = String(v).trim();
      }
    }
    if (hasMDesc) {
      const v = r[mDesc];
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        entry.metaDesc = String(v).trim();
      }
    }
    if (hasMKw) {
      const v = r[mKw];
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        entry.metaKeywords = String(v).trim();
      }
    }
    if (hasBp) {
      const arr = parseBulletpointsToArray(r[bp]);
      if (arr && arr.length) entry.bulletpoints = arr;
    }

    if (Object.keys(entry).length) {
      patch[mk] = entry;
    }
  }
  return patch;
}

/**
 * When the row uses per-market text columns, fill missing `se` fields from Sello primary columns.
 * Pure Sello rows (only standardnamesv / standarddescriptionsv) stay on flat title/description — do not seed.
 */
function seedSelloSwedenTextsIfNeeded(r, isSello, columnPatch) {
  if (!isSello) return columnPatch;
  if (!columnPatch || Object.keys(columnPatch).length === 0) return columnPatch;

  const name = toStrOrUndef(r.standardnamesv);
  const descRaw = r.standarddescriptionsv;
  const hasDesc = descRaw !== undefined && descRaw !== null && String(descRaw).trim() !== '';
  if (!name && !hasDesc) return columnPatch;

  const out = { ...columnPatch };
  const se = { ...(out.se || {}) };
  if (name && !se.name) se.name = name.slice(0, 255);
  if (hasDesc && se.description === undefined) se.description = String(descRaw).trim();
  out.se = se;
  return out;
}

/**
 * @returns {{ ok: true; patch: object } | { ok: false; code: 'invalid_channelspecificjson'; message?: string }}
 */
function parseChannelSpecificJsonColumn(r) {
  const raw = r.channelspecificjson;
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return { ok: true, patch: {} };
  }
  let parsed;
  try {
    parsed = JSON.parse(String(raw));
  } catch {
    return { ok: false, code: 'invalid_channelspecificjson', message: 'Invalid JSON' };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, code: 'invalid_channelspecificjson', message: 'Expected a JSON object' };
  }
  const bad = Object.keys(parsed).filter((k) => !CHANNEL_SPECIFIC_JSON_ROOT_KEYS.has(k));
  if (bad.length) {
    return {
      ok: false,
      code: 'invalid_channelspecificjson',
      message: `Disallowed keys: ${bad.join(', ')}`,
    };
  }
  return { ok: true, patch: parsed };
}

function resolveStandardMarketPrimary(mergedTe, explicitRaw) {
  const standardMk = normalizeImportTextsStandard(explicitRaw) ?? 'se';
  const tx = mergedTe?.[standardMk];
  const name = String(tx?.name ?? '').trim();
  const desc = String(tx?.description ?? '');
  if (!name || !importDescPlainNonEmpty(desc)) {
    return { ok: false, code: 'standard_market_texts_incomplete', market: standardMk };
  }
  return {
    ok: true,
    standardMk,
    title: name.slice(0, 255),
    description: desc,
  };
}

/**
 * Flat product fields from row (camelCase keys matching model / mergeForUpdate).
 */
function buildFlatIncomingFromRow(r, isSello) {
  const selloVat = toFloatOrUndef(r.tax);
  const selloMpn = toStrOrUndef(r.manufacturerno);

  const incoming = {
    title: isSello
      ? toStrOrUndef(r.standardnamesv) || toStrOrUndef(r.title)
      : toStrOrUndef(r.title),
    description: isSello
      ? toStrOrUndef(r.standarddescriptionsv) || toStrOrUndef(r.description)
      : toStrOrUndef(r.description),
    status: toStrOrUndef(r.status),
    quantity: toIntOrUndef(r.quantity),
    priceAmount: toFloatOrUndef(r.priceamount),
    currency: toStrOrUndef(r.currency),
    vatRate: isSello && selloVat != null ? selloVat : toFloatOrUndef(r.vatrate),
    brand: toStrOrUndef(r.brand),
    mpn: isSello ? selloMpn || undefined : toStrOrUndef(r.mpn),
    gtin: isSello ? toStrOrUndef(r.propertygtin) || undefined : toStrOrUndef(r.gtin),
    ean: isSello ? toStrOrUndef(r.propertyean) || undefined : toStrOrUndef(r.ean),

    privateName: toStrOrUndef(r.privatename),
    purchasePrice: toFloatOrUndef(r.purchaseprice),
    knNumber: toStrOrUndef(r.knnumber),
    lagerplats: toStrOrUndef(r.lagerplats),
    condition: normalizeCondition(r.condition),
    color: toStrOrUndef(r.color),
    colorText: toStrOrUndef(r.colortext),
    size: toStrOrUndef(r.size),
    sizeText: toStrOrUndef(r.sizetext),
    pattern: toStrOrUndef(r.pattern),
    material: toStrOrUndef(r.material),
    patternText: toStrOrUndef(r.patterntext),
    model: toStrOrUndef(r.model),
    weight: toFloatOrUndef(r.weight),
    volume: toFloatOrUndef(r.volume),
    volumeUnit: toStrOrUndef(r.volumeunit),
    notes: toStrOrUndef(r.notes),
    lengthCm: toFloatOrUndef(r.lengthcm),
    widthCm: toFloatOrUndef(r.widthcm),
    heightCm: toFloatOrUndef(r.heightcm),
    depthCm: toFloatOrUndef(r.depthcm),
    brandId: toPositiveIntOrUndef(r.brandid),
    supplierId: toPositiveIntOrUndef(r.supplierid),
    manufacturerId: toPositiveIntOrUndef(r.manufacturerid),
    mainImage: toStrOrUndef(r.mainimage),
    images: parseCommaSeparatedStrings(r.images),
    categories: parseCommaSeparatedStrings(r.categories),
  };

  return incoming;
}

function parseListId(r) {
  const raw = toStrOrUndef(r.listid);
  if (!raw || !/^\d+$/.test(raw)) return undefined;
  return raw;
}

/**
 * Merge textsExtended + channelSpecificJson + weightUnit column into existing.channelSpecific.
 * When per-market text columns produce a resolved primary title/description, returns them.
 *
 * @returns {{ ok: false; code: string; market?: string; message?: string } | { ok: true; channelSpecific?: object; title?: string; description?: string; usedTextsExtended: boolean }}
 */
function applyTextsAndChannelSpecific(r, existing, isSello) {
  const jsonResult = parseChannelSpecificJsonColumn(r);
  if (!jsonResult.ok) {
    return { ok: false, code: jsonResult.code, message: jsonResult.message };
  }

  let textsPatch = buildTextsExtendedPatchFromImportRow(r);
  textsPatch = seedSelloSwedenTextsIfNeeded(r, isSello, textsPatch);
  const hasTextsPatch = Object.keys(textsPatch).length > 0;

  const existingCs = existing?.channelSpecific;
  let cs = deepMergeChannelSpecific(
    existingCs && typeof existingCs === 'object' && !Array.isArray(existingCs) ? existingCs : null,
    {},
  );

  if (jsonResult.patch && Object.keys(jsonResult.patch).length > 0) {
    cs = deepMergeChannelSpecific(cs, jsonResult.patch);
  }

  const wu = toStrOrUndef(r.weightunit);
  if (wu) {
    const unit = wu.toLowerCase() === 'kg' ? 'kg' : 'g';
    cs = deepMergeChannelSpecific(cs, { weightUnit: unit });
  }

  if (hasTextsPatch) {
    const existingTe =
      cs.textsExtended && typeof cs.textsExtended === 'object' && !Array.isArray(cs.textsExtended)
        ? cs.textsExtended
        : {};
    const mergedTe = mergeTextsExtendedForImport(existingTe, textsPatch);
    const resolved = resolveStandardMarketPrimary(mergedTe, r.textsstandard);
    if (!resolved.ok) {
      return { ok: false, code: resolved.code, market: resolved.market };
    }
    cs = deepMergeChannelSpecific(cs, {
      textsExtended: mergedTe,
      textsStandard: resolved.standardMk,
    });
    return {
      ok: true,
      channelSpecific: cs,
      title: resolved.title,
      description: resolved.description,
      usedTextsExtended: true,
    };
  }

  const touchedJson = jsonResult.patch && Object.keys(jsonResult.patch).length > 0;
  if (touchedJson || wu) {
    return {
      ok: true,
      channelSpecific: cs,
      usedTextsExtended: false,
    };
  }

  return { ok: true, usedTextsExtended: false };
}

module.exports = {
  IMPORT_TEXT_MARKETS,
  CHANNEL_SPECIFIC_JSON_ROOT_KEYS,
  deepMergeChannelSpecific,
  mergeTextsExtendedForImport,
  buildTextsExtendedPatchFromImportRow,
  buildFlatIncomingFromRow,
  parseListId,
  applyTextsAndChannelSpecific,
  parseChannelSpecificJsonColumn,
  resolveStandardMarketPrimary,
  importDescPlainNonEmpty,
  toStrOrUndef,
  toIntOrUndef,
  toFloatOrUndef,
};

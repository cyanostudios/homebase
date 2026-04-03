const path = require('path');

function toTrimmedString(value) {
  if (value == null) return null;
  const s = String(value).trim();
  return s || null;
}

function isHttpUrl(value) {
  const s = toTrimmedString(value);
  if (!s) return false;
  try {
    const parsed = new URL(s);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function inferOriginalFilename(value) {
  const s = toTrimmedString(value);
  if (!s) return null;
  try {
    const u = new URL(s);
    const base = path.basename(u.pathname || '').trim();
    return base || null;
  } catch {
    return null;
  }
}

function toNumberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeVariant(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const url = toTrimmedString(raw.url);
  const key = toTrimmedString(raw.key);
  if (!url && !key) return null;
  return {
    key,
    url,
    versionId: toTrimmedString(raw.versionId),
    mimeType: toTrimmedString(raw.mimeType),
    size: toNumberOrNull(raw.size),
    width: toNumberOrNull(raw.width),
    height: toNumberOrNull(raw.height),
  };
}

function makeLegacyAsset(url, position = 0) {
  const cleanUrl = toTrimmedString(url);
  if (!cleanUrl) return null;
  const variant = {
    key: null,
    url: cleanUrl,
    versionId: null,
    mimeType: null,
    size: null,
    width: null,
    height: null,
  };
  return {
    assetId: null,
    position,
    originalFilename: inferOriginalFilename(cleanUrl),
    sourceUrl: null,
    hash: null,
    mimeType: null,
    size: null,
    width: null,
    height: null,
    variants: {
      original: variant,
      preview: { ...variant },
      thumbnail: { ...variant },
    },
    legacy: true,
  };
}

function normalizeProductImageAsset(raw, position = 0) {
  if (typeof raw === 'string') return makeLegacyAsset(raw, position);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const variantsRaw =
    raw.variants && typeof raw.variants === 'object' && !Array.isArray(raw.variants)
      ? raw.variants
      : {};
  const original = normalizeVariant(variantsRaw.original) || normalizeVariant(raw.original);
  const preview =
    normalizeVariant(variantsRaw.preview) || normalizeVariant(raw.preview) || original;
  const thumbnail =
    normalizeVariant(variantsRaw.thumbnail) ||
    normalizeVariant(raw.thumbnail) ||
    preview ||
    original;

  if (!original || !original.url) {
    const fallback = toTrimmedString(raw.url);
    if (!fallback) return null;
    return makeLegacyAsset(fallback, position);
  }

  return {
    assetId: toTrimmedString(raw.assetId) || null,
    position: toNumberOrNull(raw.position) ?? position,
    originalFilename: toTrimmedString(raw.originalFilename) || inferOriginalFilename(original.url),
    sourceUrl: toTrimmedString(raw.sourceUrl),
    hash: toTrimmedString(raw.hash),
    mimeType: toTrimmedString(raw.mimeType) || original.mimeType,
    size: toNumberOrNull(raw.size) ?? original.size,
    width: toNumberOrNull(raw.width) ?? original.width,
    height: toNumberOrNull(raw.height) ?? original.height,
    variants: {
      original,
      preview: preview || original,
      thumbnail: thumbnail || preview || original,
    },
    legacy: raw.legacy === true,
  };
}

function normalizeProductImages(rawImages) {
  const out = [];
  const seen = new Set();
  const list = Array.isArray(rawImages) ? rawImages : [];
  for (let i = 0; i < list.length; i += 1) {
    const asset = normalizeProductImageAsset(list[i], i);
    const originalUrl = asset?.variants?.original?.url || null;
    if (!asset || !originalUrl || !isHttpUrl(originalUrl)) continue;
    const key = originalUrl.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    asset.position = out.length;
    out.push(asset);
  }
  return out;
}

function getAssetOriginalUrl(asset) {
  return toTrimmedString(asset?.variants?.original?.url);
}

function getAssetPreviewUrl(asset) {
  return (
    toTrimmedString(asset?.variants?.preview?.url) ||
    toTrimmedString(asset?.variants?.original?.url) ||
    null
  );
}

function getAssetThumbnailUrl(asset) {
  return (
    toTrimmedString(asset?.variants?.thumbnail?.url) ||
    toTrimmedString(asset?.variants?.preview?.url) ||
    toTrimmedString(asset?.variants?.original?.url) ||
    null
  );
}

function getAssetOriginalFilename(asset) {
  return (
    toTrimmedString(asset?.originalFilename) || inferOriginalFilename(getAssetOriginalUrl(asset))
  );
}

function collectAssetVariantKeys(asset) {
  if (!asset || typeof asset !== 'object') return [];
  const keys = [];
  for (const variantName of ['original', 'preview', 'thumbnail']) {
    const key = toTrimmedString(asset?.variants?.[variantName]?.key);
    if (key) keys.push(key);
  }
  return Array.from(new Set(keys));
}

function collectAssetVariantDeleteTargets(asset) {
  if (!asset || typeof asset !== 'object') return [];
  const out = [];
  const seen = new Set();
  for (const variantName of ['original', 'preview', 'thumbnail']) {
    const variant = asset?.variants?.[variantName];
    const key = toTrimmedString(variant?.key);
    if (!key) continue;
    const versionId = toTrimmedString(variant?.versionId);
    const sig = `${key}@@${versionId || ''}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push({ key, versionId });
  }
  return out;
}

function collectProductOriginalImageUrls(product) {
  const mainImage = toTrimmedString(product?.mainImage);
  const assets = normalizeProductImages(product?.images);
  const out = [];
  const seen = new Set();
  if (mainImage && isHttpUrl(mainImage)) {
    seen.add(mainImage.toLowerCase());
    out.push(mainImage);
  }
  for (const asset of assets) {
    const url = getAssetOriginalUrl(asset);
    if (!url) continue;
    const key = url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(url);
  }
  return out;
}

function reorderAssetsByMainImage(assets, mainImage) {
  const normalized = normalizeProductImages(assets);
  const mainUrl = toTrimmedString(mainImage);
  if (!mainUrl) return normalized;
  const idx = normalized.findIndex((asset) => getAssetOriginalUrl(asset) === mainUrl);
  if (idx <= 0) return normalized;
  const picked = normalized[idx];
  const rest = normalized.slice();
  rest.splice(idx, 1);
  return [picked, ...rest].map((asset, position) => ({ ...asset, position }));
}

module.exports = {
  isHttpUrl,
  normalizeVariant,
  normalizeProductImageAsset,
  normalizeProductImages,
  getAssetOriginalUrl,
  getAssetPreviewUrl,
  getAssetThumbnailUrl,
  getAssetOriginalFilename,
  collectAssetVariantKeys,
  collectAssetVariantDeleteTargets,
  collectProductOriginalImageUrls,
  reorderAssetsByMainImage,
  toTrimmedString,
};

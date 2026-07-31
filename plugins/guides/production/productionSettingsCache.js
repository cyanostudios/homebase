// plugins/guides/production/productionSettingsCache.js
/** @type {Map<number, number>} */
const bustAtByUserId = new Map();

/**
 * Invalidate in-process worker settings cache for a tenant (call after UI save).
 * @param {number|string} userId
 */
function bustProductionSettingsCache(userId) {
  const id = Number(userId);
  if (!Number.isFinite(id)) return;
  bustAtByUserId.set(id, Date.now());
}

/**
 * @param {number} userId
 * @returns {number}
 */
function getProductionSettingsBustAt(userId) {
  return bustAtByUserId.get(Number(userId)) || 0;
}

module.exports = {
  bustProductionSettingsCache,
  getProductionSettingsBustAt,
};

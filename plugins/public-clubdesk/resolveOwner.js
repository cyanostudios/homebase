const ServiceManager = require('../../server/core/ServiceManager');

/**
 * Which Homebase user's tenant the public clubdesk API serves.
 * Prefer explicit numeric id; otherwise resolve email on the main DB.
 * @returns {Promise<number | null>}
 */
async function resolvePublicClubdeskUserId() {
  const rawId = process.env.PUBLIC_CLUBDESK_USER_ID;
  if (rawId && String(rawId).trim() !== '') {
    const n = parseInt(String(rawId).trim(), 10);
    if (!Number.isNaN(n) && n > 0) {
      return n;
    }
  }

  const email = process.env.PUBLIC_CLUBDESK_USER_EMAIL;
  if (email && String(email).trim() !== '') {
    try {
      const main = ServiceManager.getMainPool();
      if (!main) {
        console.warn(
          'public-clubdesk: ServiceManager.getMainPool() unavailable; cannot resolve email',
        );
        return null;
      }
      const { rows } = await main.query(
        'SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1',
        [String(email).trim()],
      );
      if (rows.length) {
        const id = Number(rows[0].id);
        if (Number.isFinite(id) && id > 0) {
          console.log(
            `public-clubdesk: resolved PUBLIC_CLUBDESK_USER_EMAIL=${String(email).trim()} → user_id=${id}`,
          );
          return id;
        }
      }
      console.warn(
        `public-clubdesk: no user found for PUBLIC_CLUBDESK_USER_EMAIL=${String(email).trim()}`,
      );
    } catch (e) {
      console.error('public-clubdesk: email lookup failed', e?.message || e);
    }
    return null;
  }

  return null;
}

module.exports = { resolvePublicClubdeskUserId };

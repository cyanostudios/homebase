// server/core/routes/fx.js
// Riksbanken FX cache: fetch latest SEK->DKK, SEK->EUR, SEK->NOK; expose GET /api/fx/latest.
// Rates are stored in main DB table fx_rates; scheduler updates 4×/dygn.

const express = require('express');
const router = express.Router();

const SERIES = [
  { id: 'SEKDKKPMI', key: 'DKK' },
  { id: 'SEKEURPMI', key: 'EUR' },
  { id: 'SEKNOKPMI', key: 'NOK' },
];

const RIKSBANKEN_LATEST_GROUP = 'https://api.riksbank.se/swea/v1/Observations/Latest/ByGroup/130';
const FETCH_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours = 4×/dygn

let pool = null;
let requireAuth = null;
let schedulerTimer = null;
let tableEnsured = false;

function setupFxRoutes(mainPool, authMiddleware) {
  pool = mainPool;
  requireAuth = authMiddleware;
}

/** Create fx_rates table in main DB if missing (so no separate migration run is required). */
async function ensureFxRatesTable(p) {
  if (!p || tableEnsured) return;
  try {
    await p.query(`
      CREATE TABLE IF NOT EXISTS fx_rates (
        series_id VARCHAR(20) PRIMARY KEY,
        rate NUMERIC(18,6) NOT NULL,
        observed_at DATE NOT NULL,
        fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    tableEnsured = true;
  } catch (err) {
    console.warn('[FX] ensureFxRatesTable:', err.message);
  }
}

/**
 * Fetch latest rates from Riksbanken and store in fx_rates.
 * API returns array of { seriesId, date, value }. Value = SEK per 1 unit of foreign currency
 * (e.g. SEKEURPMI 10.67 => 1 EUR = 10.67 SEK). So baseAmount in SEK -> EUR = baseAmount / rate.
 * @param {object} mainPool - pg Pool (main DB)
 * @returns {Promise<{ observedAt: string | null, stored: number }>}
 */
async function fetchAndStoreRates(mainPool) {
  const p = mainPool || pool;
  if (!p) return { observedAt: null, stored: 0 };

  await ensureFxRatesTable(p);

  const headers = {};
  if (process.env.RIKSBANKEN_API_KEY) {
    headers['Ocp-Apim-Subscription-Key'] = process.env.RIKSBANKEN_API_KEY;
  }

  let observedAt = null;
  let stored = 0;

  try {
    const res = await fetch(RIKSBANKEN_LATEST_GROUP, { headers });
    if (!res.ok) {
      console.warn('[FX] Riksbanken API error:', res.status, await res.text());
      return { observedAt: null, stored: 0 };
    }
    const data = await res.json();

    // ByGroup/130 returns flat array: [ { seriesId, date, value }, ... ]
    const list = Array.isArray(data) ? data : [];
    const toStore = [];
    for (const s of SERIES) {
      const row = list.find((o) => String(o.seriesId || o.SeriesId || '').toUpperCase() === s.id);
      const value = row?.value ?? row?.Value;
      const date = row?.date ?? row?.Date;
      if (value != null && Number.isFinite(Number(value))) {
        const d = date ? new Date(date) : new Date();
        const dateStr = d.toISOString ? d.toISOString().slice(0, 10) : null;
        if (dateStr) observedAt = dateStr;
        toStore.push({ series_id: s.id, rate: Number(value), observed_at: dateStr });
      }
    }

    if (toStore.length === 0) {
      console.warn('[FX] No rates parsed from Riksbanken response');
      return { observedAt: null, stored: 0 };
    }

    const fetchedAt = new Date();
    for (const row of toStore) {
      await p.query(
        `INSERT INTO fx_rates (series_id, rate, observed_at, fetched_at)
         VALUES ($1, $2, $3::date, $4)
         ON CONFLICT (series_id) DO UPDATE SET rate = $2, observed_at = $3::date, fetched_at = $4`,
        [row.series_id, row.rate, row.observed_at, fetchedAt],
      );
      stored++;
    }
    return { observedAt: observedAt || toStore[0].observed_at, stored };
  } catch (err) {
    console.error('[FX] fetchAndStoreRates error:', err.message);
    return { observedAt: null, stored: 0 };
  }
}

/**
 * GET /api/fx/latest
 * Returns latest cached rates: { DKK, EUR, NOK, observedAt }. Auth required.
 */
router.get(
  '/latest',
  (req, res, next) => requireAuth(req, res, next),
  async (req, res) => {
    try {
      const p = pool;
      if (!p) {
        return res.status(503).json({ error: 'FX service not configured' });
      }

      await ensureFxRatesTable(p);

      const result = await p.query(
        `SELECT series_id, rate, observed_at FROM fx_rates WHERE series_id = ANY($1::text[])`,
        [SERIES.map((s) => s.id)],
      );
      const rows = result.rows || [];

      const byKey = {};
      let observedAt = null;
      for (const r of rows) {
        const s = SERIES.find((x) => x.id === r.series_id);
        if (s) {
          byKey[s.key] = Number(r.rate);
          if (r.observed_at) observedAt = r.observed_at;
        }
      }

      res.json({
        DKK: byKey.DKK ?? null,
        EUR: byKey.EUR ?? null,
        NOK: byKey.NOK ?? null,
        observedAt: observedAt ?? null,
      });
    } catch (err) {
      console.error('[FX] GET /latest error:', err);
      res.status(500).json({ error: 'Failed to get FX rates' });
    }
  },
);

/**
 * Start background scheduler: fetch on startup, then every 6 hours.
 * Call once after setupFxRoutes (e.g. from core routes index).
 */
function startFxScheduler(mainPool) {
  const p = mainPool || pool;
  if (!p || schedulerTimer) return;

  fetchAndStoreRates(p).then((r) => {
    if (r.stored) console.log('[FX] Initial fetch:', r.stored, 'rates, observedAt', r.observedAt);
  });

  schedulerTimer = setInterval(() => {
    fetchAndStoreRates(p).then((r) => {
      if (r.stored) console.log('[FX] Scheduled fetch:', r.stored, 'rates');
    });
  }, FETCH_INTERVAL_MS);
  console.log('[FX] Scheduler started (every 6h)');
}

module.exports = router;
module.exports.setupFxRoutes = setupFxRoutes;
module.exports.startFxScheduler = startFxScheduler;
module.exports.fetchAndStoreRates = fetchAndStoreRates;

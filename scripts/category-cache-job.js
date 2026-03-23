// scripts/category-cache-job.js
// Background job: fill/update category_cache per tenant.
// CDON/Fyndiq: 1×/dygn; Woo: 4×/dygn (run this script via cron at desired intervals;
// this script runs one full pass – schedule it 1×/day for CDON+Fyndiq, or 4×/day for all).
// Uses same tenant list as run-all-migrations; fetches categories via shared fetch modules.

const { Pool } = require('pg');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const CredentialsCrypto = require('../server/core/services/security/CredentialsCrypto');
const { fetchCategoriesFromApi: fetchCdonCategories } = require('../plugins/cdon-products/fetchCategories');
const { fetchCategoriesFromApi: fetchFyndiqCategories } = require('../plugins/fyndiq-products/fetchCategories');
const { fetchCategoriesFromApi: fetchWooCategories } = require('../plugins/woocommerce-products/fetchCategories');

const LANGUAGE_TO_MARKET = { 'sv-SE': 'SE', 'da-DK': 'DK', 'fi-FI': 'FI', 'nb-NO': 'NO' };
const DEFAULT_CATEGORY_LANGUAGE = 'sv-SE';

async function getTenants(mainPool) {
  const tenantProvider = process.env.TENANT_PROVIDER || 'neon';
  if (tenantProvider === 'local') {
    const r = await mainPool.query('SELECT id AS user_id, email FROM users ORDER BY id');
    const base = process.env.DATABASE_URL;
    return r.rows.map((row) => ({
      user_id: row.user_id,
      email: row.email,
      connection_string: base,
      schema_name: `tenant_${row.user_id}`,
    }));
  }
  const r = await mainPool.query(`
    SELECT t.user_id, t.neon_connection_string AS connection_string, u.email
    FROM tenants t
    INNER JOIN users u ON t.user_id = u.id
    WHERE t.neon_connection_string IS NOT NULL
    ORDER BY t.user_id
  `);
  return r.rows.map((row) => ({ ...row, schema_name: null }));
}

async function upsertCategoryCache(client, cacheKey, userId, payload) {
  const fetchedAt = new Date();
  if (userId == null) {
    const up = await client.query(
      `UPDATE category_cache SET payload = $2, fetched_at = $3 WHERE cache_key = $1 AND user_id IS NULL`,
      [cacheKey, JSON.stringify(payload), fetchedAt],
    );
    if (up.rowCount === 0) {
      await client.query(
        `INSERT INTO category_cache (cache_key, user_id, payload, fetched_at) VALUES ($1, NULL, $2, $3)`,
        [cacheKey, JSON.stringify(payload), fetchedAt],
      );
    }
  } else {
    const up = await client.query(
      `UPDATE category_cache SET payload = $2, fetched_at = $3 WHERE cache_key = $1 AND user_id = $4`,
      [cacheKey, JSON.stringify(payload), fetchedAt, userId],
    );
    if (up.rowCount === 0) {
      await client.query(
        `INSERT INTO category_cache (cache_key, user_id, payload, fetched_at) VALUES ($1, $2, $3, $4)`,
        [cacheKey, userId, JSON.stringify(payload), fetchedAt],
      );
    }
  }
}

async function runJobForTenant(connectionString, tenantInfo) {
  let cleanConnectionString = connectionString;
  if (cleanConnectionString.includes('?options=') && cleanConnectionString.includes('&options=')) {
    cleanConnectionString = cleanConnectionString.split('&options=')[0];
  }
  const pool = new Pool({ connectionString: cleanConnectionString });
  const client = await pool.connect();

  try {
    if (tenantInfo.schemaName) {
      await client.query(`SET search_path TO ${tenantInfo.schemaName}`);
    }

    const userId = tenantInfo.user_id;
    let categoryLanguage = DEFAULT_CATEGORY_LANGUAGE;
    try {
      const settingsRes = await client.query(
        "SELECT settings FROM user_settings WHERE user_id = $1 AND category = 'products' LIMIT 1",
        [userId],
      );
      const settings = settingsRes?.rows?.[0]?.settings;
      if (settings && typeof settings === 'object' && settings.categoryLanguage) {
        const lang = settings.categoryLanguage;
        if (lang === 'sv-SE' || lang === 'da-DK' || lang === 'fi-FI' || lang === 'nb-NO') {
          categoryLanguage = lang;
        }
      }
    } catch (_) {
      // keep default
    }

    const market = LANGUAGE_TO_MARKET[categoryLanguage] || 'SE';
    const marketLower = market.toLowerCase();

    const cdonSettingsRes = await client.query(
      'SELECT api_key, api_secret FROM cdon_settings WHERE user_id = $1 LIMIT 1',
      [userId],
    );
    const cdonSettings = cdonSettingsRes?.rows?.[0];
    const cdonApiKey = cdonSettings?.api_key ? CredentialsCrypto.decrypt(cdonSettings.api_key) : '';
    const cdonApiSecret = cdonSettings?.api_secret ? CredentialsCrypto.decrypt(cdonSettings.api_secret) : '';
    if (cdonApiKey && cdonApiSecret) {
      const cdonCacheKey = `cdon:categories:${categoryLanguage}`;
      try {
        const items = await fetchCdonCategories(market, categoryLanguage, cdonApiKey, cdonApiSecret);
        await upsertCategoryCache(client, cdonCacheKey, null, items);
      } catch (err) {
        const msg = err?.message ?? err?.stack ?? String(err);
        console.warn(`   [${tenantInfo.email}] CDON ${cdonCacheKey}: ${msg}`);
      }
    }

    const fyndiqSettingsRes = await client.query(
      'SELECT api_key, api_secret FROM fyndiq_settings WHERE user_id = $1 LIMIT 1',
      [userId],
    );
    const fyndiqSettings = fyndiqSettingsRes?.rows?.[0];
    const fyndiqApiKey = fyndiqSettings?.api_key ? CredentialsCrypto.decrypt(fyndiqSettings.api_key) : '';
    const fyndiqApiSecret = fyndiqSettings?.api_secret ? CredentialsCrypto.decrypt(fyndiqSettings.api_secret) : '';
    if (fyndiqApiKey && fyndiqApiSecret) {
      const fyndiqCacheKey = `fyndiq:categories:${categoryLanguage}`;
      try {
        const items = await fetchFyndiqCategories(marketLower, categoryLanguage, fyndiqApiKey, fyndiqApiSecret);
        await upsertCategoryCache(client, fyndiqCacheKey, null, items);
      } catch (err) {
        const msg = err?.message ?? err?.stack ?? String(err);
        console.warn(`   [${tenantInfo.email}] Fyndiq ${fyndiqCacheKey}: ${msg}`);
      }
    }

    const instancesRes = await client.query(`
      SELECT id, user_id, channel, instance_key, market, credentials
      FROM channel_instances
      WHERE channel IN ('cdon', 'fyndiq', 'woocommerce') AND enabled = true
    `);
    const instances = instancesRes.rows || [];
    for (const inst of instances) {
      const channel = String(inst.channel || '').toLowerCase();
      const instId = String(inst.id);
      if (channel === 'woocommerce') {
        const creds = inst.credentials || {};
        const storeUrl = creds.storeUrl || creds.store_url;
        if (!storeUrl || !creds.consumerKey && !creds.consumer_key) continue;
        const credentials = {
          storeUrl,
          consumerKey: creds.consumerKey || creds.consumer_key || '',
          consumerSecret: creds.consumerSecret || creds.consumer_secret || '',
          useQueryAuth: !!creds.useQueryAuth,
        };
        try {
          const items = await fetchWooCategories(credentials, 200);
          const cacheKey = `woo:${instId}`;
          await upsertCategoryCache(client, cacheKey, inst.user_id, items);
        } catch (err) {
          console.warn(`   [${tenantInfo.email}] Woo ${instId}: ${err.message}`);
        }
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const mainPool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const tenants = await getTenants(mainPool);
    if (tenants.length === 0) {
      console.log('No tenants found.');
      return;
    }
    console.log(`Running category cache job for ${tenants.length} tenant(s)...`);
    for (const tenant of tenants) {
      const label = tenant.schema_name ? `${tenant.email} (${tenant.schema_name})` : tenant.email;
      console.log(`  Tenant: ${label}`);
      await runJobForTenant(tenant.connection_string, {
        user_id: tenant.user_id,
        email: tenant.email,
        schemaName: tenant.schema_name,
      });
    }
    console.log('Category cache job done.');
  } finally {
    await mainPool.end();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { runJobForTenant, getTenants };

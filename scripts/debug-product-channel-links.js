#!/usr/bin/env node
// Debug: vad returnerar getProductChannelLinks och varför kan det bli dubbla länkar?
// Visar rådata från channel_product_map + channel_instances och den byggda URL:en.
//
// Användning:
//   node scripts/debug-product-channel-links.js [productId]
//   PRODUCT_ID=123 node scripts/debug-product-channel-links.js
//
// Om productId saknas: visar första produkten som har minst en mapping.

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Bootstrap = require('../server/core/Bootstrap');
const { Database } = require('@homebase/core');
const ChannelsModel = require('../plugins/channels/model');

const USER_ID = Number(process.env.PHASE1_PILOT_USER_ID || process.env.USER_ID || 1);
const PRODUCT_ID = process.env.PRODUCT_ID || process.argv[2];

async function run() {
  Bootstrap.initializeServices();
  const ServiceManager = require('../server/core/ServiceManager');
  const req = {
    session: { user: { id: USER_ID }, currentTenantUserId: USER_ID },
    tenantPool: undefined,
    body: {},
    query: {},
    params: {},
  };
  ServiceManager.initialize(req);

  const db = Database.get(req);
  const model = new ChannelsModel();

  // Hitta productId
  let productId = PRODUCT_ID ? String(PRODUCT_ID).trim() : null;
  if (!productId) {
    const first = await db.query(
      `SELECT product_id::text AS product_id FROM channel_product_map
       WHERE user_id = $1 AND external_id IS NOT NULL AND TRIM(external_id) <> ''
       ORDER BY product_id LIMIT 1`,
      [USER_ID],
    );
    productId = first?.[0]?.product_id;
    if (!productId) {
      console.log('Ingen produkt med channel_product_map hittad. Kör med PRODUCT_ID=xxx.');
      process.exit(1);
    }
    console.log(`Inget productId angivet – använder första produkten med mapping: ${productId}\n`);
  }

  // Rådata: channel_product_map + channel_instances
  const rawRows = await db.query(
    `
    SELECT
      m.id AS map_id,
      m.channel,
      m.channel_instance_id,
      m.external_id,
      m.enabled,
      ci.market,
      ci.label,
      ci.instance_key
    FROM channel_product_map m
    LEFT JOIN channel_instances ci
      ON ci.id = m.channel_instance_id AND ci.user_id = m.user_id
    WHERE m.user_id = $1 AND m.product_id = $2 AND m.external_id IS NOT NULL AND TRIM(m.external_id) <> ''
    ORDER BY m.channel ASC, COALESCE(ci.market, '') ASC, COALESCE(ci.instance_key, '') ASC
    `,
    [USER_ID, productId],
  );

  console.log('=== Rådata från channel_product_map (med JOIN till channel_instances) ===');
  console.log(JSON.stringify(rawRows, null, 2));

  // Vad getProductChannelLinks returnerar
  const links = await model.getProductChannelLinks(req, productId);
  console.log('\n=== Vad getProductChannelLinks returnerar ===');
  console.log(JSON.stringify(links, null, 2));

  // Byggda URL:er (samma logik som frontend: föredra Sello, UUID→slug)
  console.log('\n=== Byggda URL:er (föredra Sello, UUID→16 tecken utan bindestreck) ===');
  const byKey = new Map();
  for (const link of links) {
    const ch = (link.channel || '').toLowerCase();
    const tld = link.market || 'se';
    const key = `${ch}:${tld}`;
    const hasInstance = link.channelInstanceId != null;
    const existing = byKey.get(key);
    const existingHasInstance = existing?.channelInstanceId != null;
    if (!existing || (hasInstance && !existingHasInstance)) byKey.set(key, link);
  }
  for (const link of byKey.values()) {
    const ch = (link.channel || '').toLowerCase();
    const tld = link.market || 'se';
    const slug = link.externalId.includes('-')
      ? link.externalId.replace(/-/g, '').slice(0, 16)
      : link.externalId;
    let url = '';
    if (ch === 'cdon') url = `https://cdon.${tld}/produkt/${slug}/`;
    else if (ch === 'fyndiq') url = `https://fyndiq.${tld}/produkt/${slug}/`;
    const label = link.market ? `${ch} (${link.market.toUpperCase()})` : ch;
    console.log(`  ${label}: ${url || '(ej stöd)'}`);
  }

  // Förklaring
  console.log('\n=== Förklaring ===');
  console.log('- Föredrar Sello-rader (channel_instance_id satt) över sync-rader');
  console.log('- UUID formateras: bindestreck bort, första 16 tecken');
  console.log('- WooCommerce: kräver backend-stöd för Sello-länk (api.sello.io/...)');

  process.exit(0);
}

run().catch((err) => {
  console.error('Fel:', err?.message || err);
  process.exit(1);
});

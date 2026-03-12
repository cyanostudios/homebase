#!/usr/bin/env node
// scripts/fetch-cdon-article-get.js
// GET en artikel från CDON API (för att se response-struktur, t.ex. specifications).
// Kräver endast CDON-inställningar (apiKey/apiSecret). Ingen produkt behöver finnas i Homebase.
// Kör: node scripts/fetch-cdon-article-get.js <sku-eller-article-id>
// Exempel: node scripts/fetch-cdon-article-get.js 49563028

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Bootstrap = require('../server/core/Bootstrap');
const CdonProductsModel = require('../plugins/cdon-products/model');
const CdonProductsController = require('../plugins/cdon-products/controller');

const USER_ID = Number(process.env.PHASE1_PILOT_USER_ID || 1);
const CDON_MERCHANTS_API = 'https://merchants-api.cdon.com/api';

async function run() {
  const ServiceManager = require('../server/core/ServiceManager');

  const identifier = process.argv[2];
  if (!identifier || !String(identifier).trim()) {
    console.error('Användning: node scripts/fetch-cdon-article-get.js <sku-eller-article-id>');
    process.exit(1);
  }

  const id = String(identifier).trim();

  Bootstrap.initializeServices();
  const req = {
    session: { user: { id: USER_ID }, currentTenantUserId: USER_ID },
    tenantPool: undefined,
  };
  ServiceManager.initialize(req);

  const model = new CdonProductsModel();
  const controller = new CdonProductsController(model);

  const settings = await model.getSettings(req);
  if (!settings?.apiKey || !settings?.apiSecret) {
    console.error('Saknar CDON-inställningar (apiKey/apiSecret). Konfigurera CDON först.');
    process.exit(1);
  }

  console.log(`GET CDON-artikel: ${id}`);

  const urlsToTry = [
    `${CDON_MERCHANTS_API}/v2/articles/${encodeURIComponent(id)}`,
    `${CDON_MERCHANTS_API}/v1/articles/${encodeURIComponent(id)}`,
    `${CDON_MERCHANTS_API}/v2/articles/sku/${encodeURIComponent(id)}`,
    `${CDON_MERCHANTS_API}/v2/articles?sku=${encodeURIComponent(id)}`,
  ];

  for (const url of urlsToTry) {
    const { resp, text, json } = await controller.cdonRequest(url, {
      merchantId: settings.apiKey,
      apiToken: settings.apiSecret,
      method: 'GET',
    });
    console.log(`GET ${url} => ${resp.status}`);
    if (resp.ok) {
      console.log(JSON.stringify(json != null ? json : { raw: text }, null, 2));
      process.exit(0);
    }
    if (resp.status === 404 && text) console.log('  Body:', text.slice(0, 300));
  }

  console.error('Alla GET-försök misslyckades (404 eller annat).');
  process.exit(1);
}

run().catch((err) => {
  console.error('Fel:', err?.message || err);
  process.exit(1);
});

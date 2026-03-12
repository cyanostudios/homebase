#!/usr/bin/env node
// scripts/fetch-group-identifiers-test.js
// Hämtar identifierare för grupperade produkter från Sello, Fyndiq, CDON och WooCommerce (Mobilhallen).
// Kör: PHASE1_PILOT_USER_ID=1 node scripts/fetch-group-identifiers-test.js
// Eller: node scripts/fetch-group-identifiers-test.js 124732563 124732564 124732565

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Bootstrap = require('../server/core/Bootstrap');
const SelloModel = require('../plugins/products/selloModel');
const FyndiqProductsModel = require('../plugins/fyndiq-products/model');
const FyndiqProductsController = require('../plugins/fyndiq-products/controller');
const CdonProductsModel = require('../plugins/cdon-products/model');
const CdonProductsController = require('../plugins/cdon-products/controller');
const WooCommerceModel = require('../plugins/woocommerce-products/model');
const WooCommerceController = require('../plugins/woocommerce-products/controller');

const USER_ID = Number(process.env.PHASE1_PILOT_USER_ID || 1);
const DEFAULT_IDS = ['124732563', '124732564', '124732565'];
const ids = process.argv.slice(2).filter(Boolean).length
  ? process.argv.slice(2).filter(Boolean).map(String)
  : DEFAULT_IDS;

const CDON_MERCHANTS_API = 'https://merchants-api.cdon.com/api';

async function run() {
  const ServiceManager = require('../server/core/ServiceManager');
  Bootstrap.initializeServices();
  const req = {
    session: { user: { id: USER_ID }, currentTenantUserId: USER_ID },
    tenantPool: undefined,
  };
  ServiceManager.initialize(req);

  const out = { productIds: ids, sello: null, fyndiq: null, cdon: null, woocommerce: null };

  // ---- Sello ----
  const selloModel = new SelloModel();
  const apiKey = await selloModel.getApiKeyForJobs(req);
  if (!apiKey) {
    out.sello = { error: 'Ingen Sello API-nyckel (sello_settings)' };
  } else {
    try {
      const listPath = `/v5/products?size=100&${ids.map((id) => `filter[id][]=${encodeURIComponent(id)}`).join('&')}`;
      const listRes = await selloModel.fetchSelloJson({ apiKey, path: listPath });
      const productsList = Array.isArray(listRes?.products) ? listRes.products : [];
      const groups = Array.isArray(listRes?.groups) ? listRes.groups : [];
      out.sello = {
        products: productsList.map((p) => ({
          id: p.id,
          group_id: p.group_id,
          private_reference: p.private_reference,
          private_name: p.private_name,
        })),
        groups: groups.map((g) => ({
          id: g.id ?? g.group_id,
          products: g.products,
          main_product: g.main_product,
          type: g.type,
        })),
      };
    } catch (e) {
      out.sello = { error: e?.message || String(e) };
    }
  }

  // ---- Fyndiq ----
  const fyndiqModel = new FyndiqProductsModel();
  const fyndiqController = new FyndiqProductsController(fyndiqModel);
  const fyndiqSettings = await fyndiqModel.getSettings(req);
  if (!fyndiqSettings?.apiKey || !fyndiqSettings?.apiSecret) {
    out.fyndiq = { error: 'Fyndiq inte konfigurerat för användaren' };
  } else {
    const articles = [];
    for (const sku of ids) {
      try {
        const { resp, json } = await fyndiqController.fyndiqRequest(
          `/api/v1/articles/sku/${encodeURIComponent(sku)}`,
          {
            username: fyndiqSettings.apiKey,
            password: fyndiqSettings.apiSecret,
            method: 'GET',
          },
        );
        const article = json?.content?.article || json?.article || json;
        if (resp.ok && article) {
          articles.push({
            sku: article.sku,
            parent_sku: article.parent_sku,
            product_id: article.product_id,
            id: article.id,
          });
        } else {
          articles.push({ sku, error: resp.status, body: json });
        }
      } catch (e) {
        articles.push({ sku, error: e?.message || String(e) });
      }
    }
    out.fyndiq = { articles };
  }

  // ---- CDON ----
  const cdonModel = new CdonProductsModel();
  const cdonController = new CdonProductsController(cdonModel);
  const cdonSettings = await cdonModel.getSettings(req);
  if (!cdonSettings?.apiKey || !cdonSettings?.apiSecret) {
    out.cdon = { error: 'CDON inte konfigurerat för användaren' };
  } else {
    const cdonArticles = [];
    const urlsToTry = (id) => [
      `${CDON_MERCHANTS_API}/v2/articles/${encodeURIComponent(id)}`,
      `${CDON_MERCHANTS_API}/v2/articles/sku/${encodeURIComponent(id)}`,
    ];
    for (const sku of ids) {
      let found = false;
      for (const url of urlsToTry(sku)) {
        try {
          const { resp, json } = await cdonController.cdonRequest(url, {
            merchantId: cdonSettings.apiKey,
            apiToken: cdonSettings.apiSecret,
            method: 'GET',
          });
          if (resp.ok && json) {
            cdonArticles.push({
              sku: json.sku ?? sku,
              parent_sku: json.parent_sku,
              id: json.id,
              source: url,
            });
            found = true;
            break;
          }
        } catch (_) {}
      }
      if (!found) cdonArticles.push({ sku, note: 'Ingen GET-artikel endpoint returnerade data' });
    }
    out.cdon = { articles: cdonArticles };
  }

  // ---- WooCommerce (Mobilhallen) ----
  // Huvudprodukt har SKU = Sello group_id (95990276), varianter har SKU = V + id (t.ex. V124732565).
  const wooSkus = ['95990276', ...ids.map((id) => `V${id}`)];
  const wooModel = new WooCommerceModel();
  const wooController = new WooCommerceController(wooModel);
  const wooInstances = await wooModel.listInstances(req);
  const mobilhallen =
    wooInstances.find((i) => /mobilhallen/i.test(String(i.label || ''))) || wooInstances[0];
  if (!mobilhallen?.credentials?.storeUrl) {
    out.woocommerce = {
      error: 'Ingen WooCommerce-instans med storeUrl (eller Mobilhallen hittades inte)',
    };
  } else {
    const creds = mobilhallen.credentials;
    const base = wooController.normalizeBaseUrl(creds.storeUrl || creds.store_url);
    const settings = {
      storeUrl: creds.storeUrl || creds.store_url,
      consumerKey: creds.consumerKey || creds.consumer_key || '',
      consumerSecret: creds.consumerSecret || creds.consumer_secret || '',
      useQueryAuth: creds.useQueryAuth || false,
    };
    const wooProducts = [];
    const parentIds = new Set();
    for (const sku of wooSkus) {
      try {
        const p = await wooController.findWooProductBySku(base, sku, settings);
        if (p) {
          wooProducts.push({
            sku: p.sku,
            id: p.id,
            type: p.type,
            parent_id: p.parent_id ?? null,
            name: p.name,
            attributes: Array.isArray(p.attributes)
              ? p.attributes
                  .map((a) => ({ id: a.id, name: a.name, option: a.option }))
                  .filter(Boolean)
              : undefined,
          });
          if (p.parent_id) parentIds.add(Number(p.parent_id));
        } else {
          wooProducts.push({ sku, note: 'Produkt hittades inte på WooCommerce' });
        }
      } catch (e) {
        wooProducts.push({ sku, error: e?.message || String(e) });
      }
    }
    // Om vi hittade varianter (parent_id satt), hämta parent-produkten för gruppinfo
    let variableProduct = null;
    if (parentIds.size > 0) {
      const parentId = [...parentIds][0];
      try {
        const url = `${base}/wp-json/wc/v3/products/${parentId}`;
        const resp = await wooController.fetchWithWooAuth(url, { method: 'GET' }, settings);
        if (resp.ok) {
          const parent = await resp.json().catch(() => null);
          if (parent) {
            variableProduct = {
              id: parent.id,
              sku: parent.sku,
              type: parent.type,
              name: parent.name,
              attributes: Array.isArray(parent.attributes)
                ? parent.attributes.map((a) => ({
                    id: a.id,
                    name: a.name,
                    variation: a.variation,
                    options: a.options,
                  }))
                : undefined,
            };
          }
        }
      } catch (_) {}
    }
    out.woocommerce = {
      instance: { id: mobilhallen.id, label: mobilhallen.label },
      products: wooProducts,
      variableProduct: variableProduct || undefined,
    };
  }

  console.log(JSON.stringify(out, null, 2));
}

run().catch((err) => {
  console.error('Fel:', err?.message || err);
  process.exit(1);
});

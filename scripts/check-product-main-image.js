#!/usr/bin/env node
// Read product from DB and print main_image / images (to verify Sello import).
// Run: node scripts/check-product-main-image.js 109512000

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Bootstrap = require('../server/core/Bootstrap');
const ProductModel = require('../plugins/products/model');

const productId = process.argv[2] || '109512000';

async function run() {
  Bootstrap.initializeServices();
  const ServiceManager = require('../server/core/ServiceManager');
  const req = {
    session: { user: { id: 1 }, tenantOwnerUserId: 1 },
    tenantPool: undefined,
  };
  ServiceManager.initialize(req);
  const model = new ProductModel();
  const product = await model.getById(req, productId);
  if (!product) {
    console.log('Product not found:', productId);
    process.exit(1);
  }
  console.log('mainImage:', product.mainImage == null ? '(null)' : product.mainImage);
  console.log('images count:', Array.isArray(product.images) ? product.images.length : 0);
  if (
    product.mainImage &&
    (product.mainImage.startsWith('http://') || product.mainImage.startsWith('https://'))
  ) {
    console.log('mainImage is valid URL: yes');
  } else {
    console.log('mainImage is valid URL: no');
  }
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

// scripts/test-quantity-push-channels.js
// Loggar in, tar första produkten, ökar quantity med 1 via PATCH /api/products/batch,
// och visar respons. Push till kanaler (Woo/CDON/Fyndiq) sker i backend – kolla serverloggen.
// Kör: node scripts/test-quantity-push-channels.js
// Kräver: servern kör (npm run dev), .env med TEST_USER_EMAIL och TEST_USER_PASSWORD.

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const BASE = process.env.BASE_URL || 'http://localhost:3002';

async function main() {
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;
  if (!email || !password) {
    console.error('Sätt TEST_USER_EMAIL och TEST_USER_PASSWORD i .env eller .env.local');
    process.exit(1);
  }

  const cookies = [];
  function storeCookies(res) {
    const set = res.headers.get('set-cookie');
    if (set) {
      set.split(',').forEach((c) => {
        const part = c.split(';')[0].trim();
        if (part) cookies.push(part);
      });
    }
  }
  const cookieHeader = () => (cookies.length ? { Cookie: cookies.join('; ') } : {});

  // 1) Login
  console.log('1) Loggar in...');
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    credentials: 'include',
    redirect: 'manual',
  });
  storeCookies(loginRes);
  if (!loginRes.ok) {
    const t = await loginRes.text();
    console.error('Login misslyckades:', loginRes.status, t);
    process.exit(1);
  }
  console.log('   OK');

  // 2) CSRF
  console.log('2) Hämtar CSRF-token...');
  const csrfRes = await fetch(`${BASE}/api/csrf-token`, {
    credentials: 'include',
    headers: cookieHeader(),
  });
  storeCookies(csrfRes);
  const csrfData = await csrfRes.json().catch(() => ({}));
  const csrf = csrfData.csrfToken || '';
  if (!csrf) {
    console.error('Ingen CSRF-token');
    process.exit(1);
  }
  console.log('   OK');

  // 3) Lista produkter
  console.log('3) Hämtar produkter...');
  const productsRes = await fetch(`${BASE}/api/products`, {
    credentials: 'include',
    headers: cookieHeader(),
  });
  if (!productsRes.ok) {
    console.error('GET /api/products:', productsRes.status, await productsRes.text());
    process.exit(1);
  }
  const products = await productsRes.json();
  const list = Array.isArray(products) ? products : products?.products || [];
  if (list.length === 0) {
    console.error('Inga produkter hittades.');
    process.exit(1);
  }
  const first = list[0];
  const productId = first.id != null ? String(first.id) : first.productId;
  const currentQty = first.quantity != null ? Number(first.quantity) : 0;
  const newQty = currentQty + 1;
  console.log(
    `   Produkt id=${productId} titel="${(first.title || '').slice(0, 40)}..." quantity: ${currentQty} -> ${newQty}`,
  );

  // 4) PATCH batch (quantity +1) – triggar push till kanaler i backend
  console.log('4) PATCH /api/products/batch (quantity +1)...');
  const patchRes = await fetch(`${BASE}/api/products/batch`, {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      ...cookieHeader(),
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrf,
    },
    body: JSON.stringify({ ids: [productId], updates: { quantity: newQty } }),
  });
  const patchBody = await patchRes.json().catch(() => ({}));
  console.log('   Status:', patchRes.status);
  console.log('   Body:', JSON.stringify(patchBody, null, 2));

  if (!patchRes.ok) {
    console.error('Batch update misslyckades.');
    process.exit(1);
  }
  if (patchBody.ok && patchBody.updatedCount >= 1) {
    console.log(
      '\nBatch update lyckades. Backend har pushat till aktiva kanaler (Woo/CDON/Fyndiq).',
    );
    console.log('Kolla serverloggen för eventuella kanal-fel.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Guides plugin browser E2E (local or Railway).
 * Usage:
 *   node scripts/guides-browser-e2e.js
 *   GUIDES_E2E_BASE_URL=https://sweet-courtesy-production-fa4e.up.railway.app node scripts/guides-browser-e2e.js
 *
 * Env: GUIDES_E2E_EMAIL, GUIDES_E2E_PASSWORD (defaults: admin@homebase.se / admin123 for local dev)
 */

const puppeteer = require('puppeteer');

const BASE_URL = process.env.GUIDES_E2E_BASE_URL || 'http://localhost:3001';
const EMAIL = process.env.GUIDES_E2E_EMAIL || 'admin@homebase.se';
const PASSWORD = process.env.GUIDES_E2E_PASSWORD || 'admin123';

const RAW_KEY_RE = /\b(?:common|guides|nav|panel)\.[a-zA-Z][\w.-]*\b/;

const results = [];
let failed = 0;

function pass(id, detail) {
  results.push({ id, status: 'PASS', detail });
  console.log(`  ✅ ${id}: ${detail}`);
}

function fail(id, detail) {
  failed += 1;
  results.push({ id, status: 'FAIL', detail });
  console.log(`  ❌ ${id}: ${detail}`);
}

function skip(id, detail) {
  results.push({ id, status: 'SKIP', detail });
  console.log(`  ⏭️  ${id}: ${detail}`);
}

async function fillInput(page, selector, value) {
  await page.waitForSelector(selector, { timeout: 10000 });
  await page.click(selector, { clickCount: 3 });
  await page.keyboard.press('Backspace');
  await page.type(selector, value, { delay: 15 });
}

async function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function clickByText(page, text, { tag = 'button' } = {}) {
  const clicked = await page.evaluate(
    (t, tg) => {
      const nodes = [...document.querySelectorAll(tg)];
      const el = nodes.find((n) => n.textContent?.trim().includes(t));
      if (el) {
        el.click();
        return true;
      }
      return false;
    },
    text,
    tag,
  );
  return clicked;
}

async function bodyText(page) {
  return page.evaluate(() => document.body.innerText);
}

async function scanRawI18nKeys(page, lang) {
  const text = await bodyText(page);
  const matches = text.match(new RegExp(RAW_KEY_RE.source, 'g')) || [];
  const unique = [...new Set(matches)];
  if (unique.length > 0) {
    fail(`i18n-${lang}`, `Raw keys visible: ${unique.join(', ')}`);
    return false;
  }
  pass(`i18n-${lang}`, 'No raw i18n keys in visible text');
  return true;
}

async function run() {
  console.log(`\n🔍 Guides browser E2E — ${BASE_URL}\n`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const consoleErrors = [];
  const pageErrors = [];
  let consoleCaptureFrom = 0;

  page.on('console', (msg) => {
    if (msg.type() === 'error' && Date.now() >= consoleCaptureFrom) {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
  });

  let placeName = `E2E Place ${Date.now()}`;
  let placeNameEdited = `${placeName} Edited`;

  try {
    // --- Login ---
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2', timeout: 30000 });
    const emailSel = 'input[type="email"], input[name="email"]';
    const passSel = 'input[type="password"], input[name="password"]';
    await fillInput(page, emailSel, EMAIL);
    await fillInput(page, passSel, PASSWORD);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => null),
      page.keyboard.press('Enter'),
    ]);
    await wait(2000);
    if (page.url().includes('/login')) {
      (await clickByText(page, 'Log in')) || (await clickByText(page, 'Logga in'));
      await wait(2000);
    }
    if (page.url().includes('/login')) {
      fail('login', 'Still on login page after submit');
    } else {
      const meCheck = await page.evaluate(async () => {
        const r = await fetch('/api/auth/me', { credentials: 'include' });
        return r.status;
      });
      if (meCheck !== 200) {
        fail('login', `Session not established (/api/auth/me → ${meCheck})`);
      } else {
        pass('login', `Logged in as ${EMAIL} → ${page.url()}`);
      }
    }

    // --- RBAC: /api/auth/me has guides (same-origin via Vite proxy) ---
    const meRes = await page.evaluate(async () => {
      const r = await fetch('/api/auth/me', { credentials: 'include' });
      return { status: r.status, body: await r.json().catch(() => ({})) };
    });
    if (meRes.status !== 200) {
      fail('rbac-me', `/api/auth/me returned ${meRes.status}`);
    } else if (
      !Array.isArray(meRes.body?.user?.plugins) ||
      !meRes.body.user.plugins.includes('guides')
    ) {
      fail('rbac-me', `guides not in plugins: ${JSON.stringify(meRes.body?.user?.plugins)}`);
    } else {
      pass('rbac-me', 'guides in user.plugins');
    }

    // --- Sidebar: expand Content and click Guides ---
    await wait(1000);
    await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('button')];
      const content = nodes.find((n) => {
        const t = n.textContent?.trim() || '';
        return t === 'Content' || t === 'Innehåll';
      });
      if (content) content.click();
    });
    await wait(400);
    const navClicked = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('button, a')];
      const el = nodes.find((n) => {
        const t = n.textContent?.trim() || '';
        return t === 'Guides' || t === 'Guider';
      });
      if (el) {
        el.click();
        return true;
      }
      return false;
    });
    if (navClicked) {
      await wait(1500);
      pass('sidebar', 'Guides nav item clicked');
    } else {
      skip('sidebar', 'Guides nav not found — trying direct /guides route');
    }

    // --- Routing: /guides ---
    if (!page.url().includes('/guides')) {
      await page.goto(`${BASE_URL}/guides`, { waitUntil: 'networkidle2', timeout: 20000 });
    }
    consoleCaptureFrom = Date.now();
    await wait(500);
    if (page.url().includes('/guides')) {
      pass('routing-list', 'Navigated to /guides');
    } else {
      fail('routing-list', `Expected /guides, got ${page.url()}`);
    }
    await scanRawI18nKeys(page, 'en-list');

    // --- Create place ---
    const addClicked =
      (await clickByText(page, 'Add place')) || (await clickByText(page, 'Lägg till plats'));
    if (!addClicked) {
      fail('place-create', 'Add place button not found');
    } else {
      await wait(800);
      await page.waitForSelector('#guide-display-name', { timeout: 8000 });
      await page.type('#guide-display-name', placeName, { delay: 20 });
      const saveClicked = (await clickByText(page, 'Save')) || (await clickByText(page, 'Spara'));
      if (!saveClicked) {
        fail('place-create', 'Save button not found');
      } else {
        await wait(2000);
        const listAfter = await bodyText(page);
        if (listAfter.includes(placeName)) {
          pass('place-create', `Created "${placeName}"`);
        } else {
          fail('place-create', `Place name not in list after save`);
        }
      }
    }

    // --- Open GuideView ---
    const opened = await page.evaluate((name) => {
      const row = [...document.querySelectorAll('tr')].find((r) => r.textContent?.includes(name));
      if (row) {
        row.click();
        return true;
      }
      return false;
    }, placeName);
    if (!opened) {
      fail('guide-view', 'Could not open place row');
    } else {
      await wait(2000);
      const viewText = await bodyText(page);
      if (viewText.includes(placeName)) {
        pass('guide-view', 'GuideView shows place name');
      } else {
        fail('guide-view', 'GuideView does not show place name');
      }
    }

    const viewUrl = page.url();
    await page.reload({ waitUntil: 'networkidle2' });
    if (page.url() === viewUrl || page.url().includes('/guides/')) {
      pass('refresh-view', `Refresh OK on ${page.url()}`);
    } else {
      fail('refresh-view', `Refresh lost route: ${page.url()}`);
    }

    // --- Edit place ---
    const editClicked = (await clickByText(page, 'Edit')) || (await clickByText(page, 'Redigera'));
    if (!editClicked) {
      fail('place-edit', 'Edit button not found');
    } else {
      await wait(1000);
      await page.waitForSelector('#guide-display-name', { timeout: 8000 });
      await page.$eval('#guide-display-name', (el) => {
        el.value = '';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await page.type('#guide-display-name', placeNameEdited, { delay: 20 });
      const updateClicked =
        (await clickByText(page, 'Update')) ||
        (await clickByText(page, 'Uppdatera')) ||
        (await clickByText(page, 'Save')) ||
        (await clickByText(page, 'Spara'));
      await wait(2000);
      const afterEdit = await bodyText(page);
      if (afterEdit.includes(placeNameEdited)) {
        pass('place-edit', 'Place updated');
        placeName = placeNameEdited;
      } else {
        fail('place-edit', 'Updated name not visible');
      }
    }

    // --- GuideStops: create ---
    const addStopClicked =
      (await clickByText(page, 'Add stop')) || (await clickByText(page, 'Lägg till stopp'));
    if (!addStopClicked) {
      fail('stop-create', 'Add stop button not found');
    } else {
      await wait(500);
      await page.waitForSelector('#guide-stop-title', { timeout: 8000 });
      await page.type('#guide-stop-title', 'E2E Stop A', { delay: 20 });
      await page.type('#guide-stop-narrative', 'Canonical narrative for E2E.', { delay: 10 });
      (await clickByText(page, 'Save')) || (await clickByText(page, 'Spara'));
      await wait(2000);
      const stopText = await bodyText(page);
      if (stopText.includes('E2E Stop A')) {
        pass('stop-create', 'Stop created');
      } else {
        fail('stop-create', 'Stop not visible after save');
      }
    }

    // Second stop for reorder
    const addStop2 =
      (await clickByText(page, 'Add stop')) || (await clickByText(page, 'Lägg till stopp'));
    if (addStop2) {
      await wait(500);
      const titleInput = await page.$('#guide-stop-title');
      if (titleInput) {
        await page.type('#guide-stop-title', 'E2E Stop B', { delay: 20 });
        (await clickByText(page, 'Save')) || (await clickByText(page, 'Spara'));
        await wait(2000);
      }
    }

    // Reorder: move B up
    const moved = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('button[aria-label]')];
      const moveUp = buttons.find((b) => {
        const label = b.getAttribute('aria-label') || '';
        return label.includes('up') || label.includes('upp');
      });
      if (moveUp) {
        moveUp.click();
        return true;
      }
      return false;
    });
    await wait(1500);
    if (moved) {
      pass('stop-reorder', 'Reorder button clicked');
    } else {
      skip('stop-reorder', 'Move up button not found (may need 2+ stops)');
    }

    // --- Variant ---
    const addVariantClicked =
      (await clickByText(page, 'Add variant')) || (await clickByText(page, 'Lägg till variant'));
    if (!addVariantClicked) {
      fail('variant-create', 'Add variant button not found');
    } else {
      await wait(500);
      const variantTextarea = await page.$('textarea[id*="variant-text-create"]');
      if (variantTextarea) {
        await variantTextarea.type('Presentation text for E2E audio.', { delay: 10 });
      }
      (await clickByText(page, 'Save')) || (await clickByText(page, 'Spara'));
      await wait(2000);
      const vText = await bodyText(page);
      if (
        vText.includes('Presentation text for E2E') ||
        vText.includes('Normal') ||
        vText.includes('normal')
      ) {
        pass('variant-create', 'Variant created');
      } else {
        fail('variant-create', 'Variant not visible after save');
      }
    }

    // --- Audio generate ---
    const genClicked =
      (await clickByText(page, 'Generate audio')) || (await clickByText(page, 'Generera ljud'));
    if (!genClicked) {
      fail('audio-generate', 'Generate audio button not found');
    } else {
      await wait(4000);
      const audioText = await bodyText(page);
      if (audioText.match(/Ready|Klar|Processing|Genererar|Pending|Väntar/i)) {
        pass('audio-generate', 'Audio status updated after generate');
      } else {
        fail('audio-generate', 'No audio status after generate');
      }
    }

    // --- Swedish locale ---
    await page.evaluate(() => {
      localStorage.setItem('homebase-language', 'sv');
    });
    await page.reload({ waitUntil: 'networkidle2' });
    await wait(1500);
    await scanRawI18nKeys(page, 'sv-view');

    // --- English locale ---
    await page.evaluate(() => {
      localStorage.setItem('homebase-language', 'en');
    });
    await page.reload({ waitUntil: 'networkidle2' });
    await wait(1500);
    await scanRawI18nKeys(page, 'en-view');

    // --- Delete place (with confirm) ---
    await page.goto(`${BASE_URL}/guides`, { waitUntil: 'networkidle2' });
    await page.evaluate((name) => {
      const row = [...document.querySelectorAll('tr')].find((r) => r.textContent?.includes(name));
      row?.click();
    }, placeName);
    await wait(2500);

    let deleteClicked = false;
    try {
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll('button')].some((b) => {
            const t = b.textContent?.trim() || '';
            return t === 'Delete' || t === 'Ta bort';
          }),
        { timeout: 10000 },
      );
      deleteClicked = await page.evaluate(() => {
        const dels = [...document.querySelectorAll('button')].filter((b) => {
          const t = b.textContent?.trim() || '';
          return t === 'Delete' || t === 'Ta bort';
        });
        const del = dels[dels.length - 1];
        if (del) {
          del.click();
          return true;
        }
        return false;
      });
    } catch {
      deleteClicked = false;
    }
    if (!deleteClicked) {
      fail('place-delete', 'Delete button not found in guide panel');
    } else {
      await wait(600);
      const confirmClicked = await page.evaluate(() => {
        const dialogs = [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')];
        const dialog = dialogs[dialogs.length - 1];
        if (!dialog) return false;
        const btn = [...dialog.querySelectorAll('button')].find((b) => {
          const t = b.textContent?.trim() || '';
          return t === 'Delete' || t === 'Ta bort';
        });
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      });
      await wait(2500);
      const afterDelete = await bodyText(page);
      if (!afterDelete.includes(placeName)) {
        pass('place-delete', 'Place deleted after confirm');
      } else if (confirmClicked) {
        fail('place-delete', 'Place still visible after delete confirm');
      } else {
        fail('place-delete', 'Confirm dialog delete not clicked');
      }
    }

    // --- Console / page errors ---
    const guidesConsole = consoleErrors.filter(
      (e) =>
        !e.includes('favicon') &&
        !e.includes('DevTools') &&
        (e.toLowerCase().includes('guides') || e.includes('/api/guides')),
    );
    if (guidesConsole.length === 0) {
      pass('console', 'No guides-related browser console errors');
    } else {
      fail('console', `${guidesConsole.length} errors: ${guidesConsole.slice(0, 3).join(' | ')}`);
    }
    if (pageErrors.length === 0) {
      pass('page-errors', 'No uncaught page errors');
    } else {
      fail('page-errors', pageErrors.slice(0, 3).join(' | '));
    }
  } catch (err) {
    fail('fatal', err.message);
    console.error(err);
  } finally {
    await browser.close();
  }

  console.log('\n--- Summary ---');
  const passCount = results.filter((r) => r.status === 'PASS').length;
  const failCount = results.filter((r) => r.status === 'FAIL').length;
  const skipCount = results.filter((r) => r.status === 'SKIP').length;
  console.log(`PASS: ${passCount}  FAIL: ${failCount}  SKIP: ${skipCount}`);
  console.log(failed === 0 ? '\n✅ E2E GREEN\n' : '\n❌ E2E FAILED\n');
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

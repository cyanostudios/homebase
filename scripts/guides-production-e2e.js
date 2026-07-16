#!/usr/bin/env node
/**
 * P-FRONTEND production flow E2E (local).
 * Usage: node scripts/guides-production-e2e.js
 *
 * Requires: npm run dev:all (API :3002, UI :3001)
 * Worker: pumps via scripts/run-production-worker-tick.js (API may have worker disabled).
 */
const { execFileSync } = require('child_process');
const path = require('path');
const puppeteer = require('puppeteer');

if (!process.env.PUPPETEER_CACHE_DIR) {
  process.env.PUPPETEER_CACHE_DIR = path.join(__dirname, '..', '.cache', 'puppeteer');
}

const BASE_URL = process.env.GUIDES_E2E_BASE_URL || 'http://localhost:3001';
const EMAIL = process.env.GUIDES_E2E_EMAIL || 'admin@homebase.se';
const PASSWORD = process.env.GUIDES_E2E_PASSWORD || 'admin123';
const TICK_SCRIPT = path.join(__dirname, 'run-production-worker-tick.js');
const MAX_PUMP_ROUNDS = 120;
const PUMP_INTERVAL_MS = 1500;

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

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function pumpWorker() {
  execFileSync(process.execPath, [TICK_SCRIPT], {
    stdio: 'pipe',
    cwd: path.join(__dirname, '..'),
    env: process.env,
  });
}

async function pumpUntil(page, predicate, label) {
  for (let i = 0; i < MAX_PUMP_ROUNDS; i += 1) {
    const state = await predicate(page);
    if (state.done) return state;
    try {
      pumpWorker();
    } catch (err) {
      return { done: false, error: `worker tick failed: ${err.message}` };
    }
    await wait(PUMP_INTERVAL_MS);
    if (i % 5 === 4) {
      process.stdout.write(`    … pumping ${label} (${i + 1}/${MAX_PUMP_ROUNDS})\n`);
    }
  }
  return { done: false, error: `timeout waiting for ${label}` };
}

async function apiCall(page, method, urlPath, body) {
  return page.evaluate(
    async (m, p, b) => {
      const csrfRes = await fetch('/api/csrf-token', { credentials: 'include' });
      const csrfData = await csrfRes.json().catch(() => ({}));
      const headers = { 'Content-Type': 'application/json' };
      if (csrfData.csrfToken && csrfData.csrfToken !== 'csrf-disabled') {
        headers['X-CSRF-Token'] = csrfData.csrfToken;
      }
      const res = await fetch(p, {
        method: m,
        credentials: 'include',
        headers,
        body: b != null ? JSON.stringify(b) : undefined,
      });
      return {
        status: res.status,
        body: await res.json().catch(() => null),
      };
    },
    method,
    urlPath,
    body ?? null,
  );
}

async function fillInput(page, selector, value) {
  await page.waitForSelector(selector, { timeout: 10000 });
  await page.click(selector, { clickCount: 3 });
  await page.keyboard.press('Backspace');
  await page.type(selector, value, { delay: 10 });
}

async function clickByText(page, text, { tag = 'button' } = {}) {
  return page.evaluate(
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
}

async function bodyText(page) {
  return page.evaluate(() => document.body.innerText);
}

async function isStartFullGuideDisabled(page) {
  return page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => {
      const t = b.textContent?.trim() || '';
      return t.includes('Producera hel guide') || t.includes('Produce full guide');
    });
    return btn ? btn.disabled : null;
  });
}

async function login(page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2', timeout: 30000 });
  await fillInput(page, 'input[type="email"], input[name="email"]', EMAIL);
  await fillInput(page, 'input[type="password"], input[name="password"]', PASSWORD);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => null),
    page.keyboard.press('Enter'),
  ]);
  await wait(1500);
  const me = await apiCall(page, 'GET', '/api/auth/me');
  if (me.status !== 200) {
    fail('pre-login', `/api/auth/me → ${me.status}`);
    return false;
  }
  pass('pre-login', `Session OK as ${EMAIL}`);
  return true;
}

async function navigateToGuides(page) {
  await page.goto(`${BASE_URL}/guides`, { waitUntil: 'networkidle2' });
  await wait(500);
  if (!page.url().includes('/guides')) {
    await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('button')];
      const content = nodes.find((n) => {
        const t = n.textContent?.trim() || '';
        return t === 'Content' || t === 'Innehåll';
      });
      if (content) content.click();
    });
    await wait(400);
    await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('button, a')];
      const el = nodes.find((n) => {
        const t = n.textContent?.trim() || '';
        return t === 'Guides' || t === 'Guider';
      });
      if (el) el.click();
    });
    await wait(1500);
  }
  if (!page.url().includes('/guides')) {
    await page.goto(`${BASE_URL}/guides`, { waitUntil: 'networkidle2' });
  }
}

async function resolvePlaceId(page, displayName) {
  const list = await apiCall(page, 'GET', '/api/guides');
  if (list.status !== 200 || !Array.isArray(list.body)) return null;
  const match = list.body.find((g) => g.displayName === displayName);
  return match?.id ?? null;
}

async function ensureGuideWithContent(page) {
  await navigateToGuides(page);
  await wait(800);

  const placeName = `E2E Production ${Date.now()}`;
  const addClicked =
    (await clickByText(page, 'Add place')) || (await clickByText(page, 'Lägg till plats'));
  if (!addClicked) {
    fail('setup-place', 'Add place not found');
    return null;
  }
  await wait(500);
  await page.waitForSelector('#guide-display-name', { timeout: 8000 });
  await page.type('#guide-display-name', placeName, { delay: 15 });
  (await clickByText(page, 'Save')) || (await clickByText(page, 'Spara'));
  await wait(2000);

  await page.evaluate((name) => {
    const row = [...document.querySelectorAll('tr')].find((r) => r.textContent?.includes(name));
    row?.click();
  }, placeName);
  await wait(2000);

  const placeId = await resolvePlaceId(page, placeName);
  if (!placeId) {
    fail('setup-placeId', `Could not resolve placeId for "${placeName}" via /api/guides`);
    return null;
  }
  const addStop =
    (await clickByText(page, 'Add stop')) || (await clickByText(page, 'Lägg till stopp'));
  if (!addStop) {
    fail('setup-stop', 'Add stop not found');
    return null;
  }
  await wait(400);
  await page.waitForSelector('#guide-stop-title', { timeout: 8000 });
  await page.type('#guide-stop-title', 'E2E Prod Stop', { delay: 10 });
  await page.type('#guide-stop-narrative', 'Canonical narrative for production E2E test.', {
    delay: 8,
  });
  (await clickByText(page, 'Save')) || (await clickByText(page, 'Spara'));
  await wait(2000);

  const addVariant =
    (await clickByText(page, 'Add variant')) || (await clickByText(page, 'Lägg till variant'));
  if (!addVariant) {
    fail('setup-variant', 'Add variant not found');
    return null;
  }
  await wait(400);
  const ta = await page.$('textarea[id*="variant-text-create"]');
  if (ta) {
    await ta.type('Existing presentation baseline.', { delay: 8 });
  }
  (await clickByText(page, 'Save')) || (await clickByText(page, 'Spara'));
  await wait(2000);

  pass('setup-content', `Guide ${placeId} with stop + variant`);
  return placeId;
}

async function cancelActiveJobs(page, placeId) {
  const list = await apiCall(page, 'GET', `/api/guides/${placeId}/production-jobs`);
  if (list.status !== 200) return;
  const active = (list.body || []).filter((j) =>
    ['pending', 'planning', 'processing', 'awaiting_review'].includes(j.status),
  );
  for (const job of active) {
    await apiCall(page, 'POST', `/api/guides/${placeId}/production-jobs/${job.id}/cancel`, {});
  }
  if (active.length) {
    pass('pre-cancel', `Cancelled ${active.length} active job(s)`);
  }
}

async function run() {
  console.log(`\n🔍 P-FRONTEND production E2E — ${BASE_URL}\n`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  let placeId = null;
  let jobId = null;

  try {
    if (!(await login(page))) return;

    placeId = await ensureGuideWithContent(page);
    if (!placeId) return;

    await cancelActiveJobs(page, placeId);

    // --- A: Start full guide ---
    const startBtn =
      (await clickByText(page, 'Produce full guide')) ||
      (await clickByText(page, 'Producera hel guide'));
    if (!startBtn) {
      fail('A-start-btn', 'Start full guide button not found');
      return;
    }
    await wait(500);
    const forceBox = await page.$('#production-force');
    if (forceBox) {
      await forceBox.click();
    }
    const confirmStart =
      (await clickByText(page, 'Start production')) ||
      (await clickByText(page, 'Starta produktion'));
    if (!confirmStart) {
      fail('A-start-confirm', 'Start production confirm not found');
      return;
    }
    await wait(1500);

    const startDisabled = await isStartFullGuideDisabled(page);
    if (startDisabled !== true) {
      fail('A-active-guard', `Expected start disabled after job start, got ${startDisabled}`);
    } else {
      pass('A-active-guard', 'Start full guide disabled while job active');
    }

    let listRes = await apiCall(page, 'GET', `/api/guides/${placeId}/production-jobs`);
    const activeJob = (listRes.body || []).find((j) =>
      ['pending', 'planning', 'processing', 'awaiting_review'].includes(j.status),
    );
    if (!activeJob) {
      fail('A-job-created', 'No active job after start');
      return;
    }
    jobId = activeJob.id;
    pass('A-job-created', `Job #${jobId} status=${activeJob.status}`);

    const pumpReview = await pumpUntil(
      page,
      async (p) => {
        const detail = await apiCall(p, 'GET', `/api/guides/${placeId}/production-jobs/${jobId}`);
        const status = detail.body?.job?.status;
        if (status === 'awaiting_review') return { done: true, status };
        if (status === 'failed')
          return { done: true, status, error: detail.body?.job?.errorMessage };
        return { done: false, status };
      },
      'awaiting_review',
    );
    if (pumpReview.error || pumpReview.status === 'failed') {
      fail('B-await-review', pumpReview.error || `job failed: ${pumpReview.status}`);
      return;
    }
    pass('B-await-review', 'Job reached awaiting_review');

    const text = await bodyText(page);
    if (text.match(/Granska textutkast|Review text drafts/i)) {
      pass('B-banner-review', 'Review banner text visible');
    } else {
      fail('B-banner-review', 'Review banner text not found in page');
    }

    const detail = await apiCall(page, 'GET', `/api/guides/${placeId}/production-jobs/${jobId}`);
    const items = detail.body?.items || [];
    const reviewable = items.filter(
      (i) =>
        i.phaseIndex === detail.body.job.currentPhaseIndex &&
        i.status === 'completed' &&
        (i.reviewStatus === 'pending_review' || !i.reviewStatus),
    );
    if (reviewable.length === 0) {
      fail('B-review-items', 'No pending_review items in current phase');
      return;
    }

    const first = reviewable[0];
    const rejectTarget = reviewable[1];
    const regenTarget = reviewable[2] || reviewable[0];

    const approveRes = await apiCall(
      page,
      'POST',
      `/api/guides/${placeId}/production-jobs/${jobId}/items/${first.id}/approve`,
      {},
    );
    if (approveRes.status !== 200) {
      fail('B-approve', `approve → ${approveRes.status}`);
    } else {
      pass('B-approve', `Approved item ${first.id}`);
    }

    if (rejectTarget && rejectTarget.id !== first.id) {
      const rejectRes = await apiCall(
        page,
        'POST',
        `/api/guides/${placeId}/production-jobs/${jobId}/items/${rejectTarget.id}/reject`,
        {},
      );
      if (rejectRes.status !== 200) {
        fail('B-reject', `reject → ${rejectRes.status}`);
      } else {
        pass('B-reject', `Rejected item ${rejectTarget.id}`);
      }
    } else {
      skip('B-reject', 'Only one review item — skipped reject');
    }

    const regenRes = await apiCall(
      page,
      'POST',
      `/api/guides/${placeId}/production-jobs/${jobId}/items/${regenTarget.id}/regenerate`,
      {},
    );
    if (regenRes.status !== 200) {
      fail('B-regenerate', `regenerate → ${regenRes.status}`);
    } else {
      pass('B-regenerate', `Regenerate triggered for item ${regenTarget.id}`);
    }

    await pumpUntil(
      page,
      async (p) => {
        const d = await apiCall(p, 'GET', `/api/guides/${placeId}/production-jobs/${jobId}`);
        const phaseItems = (d.body?.items || []).filter(
          (i) => i.phaseIndex === d.body.job.currentPhaseIndex,
        );
        const pending = phaseItems.filter(
          (i) =>
            i.status === 'completed' && (i.reviewStatus === 'pending_review' || !i.reviewStatus),
        );
        const inFlight = phaseItems.some((i) =>
          ['pending', 'queued', 'processing', 'awaiting_callback'].includes(i.status),
        );
        if (!inFlight && pending.length === 0) return { done: true };
        return { done: false, pending: pending.length, inFlight };
      },
      'review decisions',
    );

    for (const item of reviewable) {
      await apiCall(
        page,
        'POST',
        `/api/guides/${placeId}/production-jobs/${jobId}/items/${item.id}/approve`,
        {},
      ).catch(() => null);
      await apiCall(
        page,
        'POST',
        `/api/guides/${placeId}/production-jobs/${jobId}/items/${item.id}/reject`,
        {},
      ).catch(() => null);
    }

    const freshDetail = await apiCall(
      page,
      'GET',
      `/api/guides/${placeId}/production-jobs/${jobId}`,
    );
    const remaining = (freshDetail.body?.items || []).filter(
      (i) =>
        i.phaseIndex === freshDetail.body.job.currentPhaseIndex &&
        i.status === 'completed' &&
        (i.reviewStatus === 'pending_review' || !i.reviewStatus),
    );
    for (const item of remaining) {
      await apiCall(
        page,
        'POST',
        `/api/guides/${placeId}/production-jobs/${jobId}/items/${item.id}/approve`,
        {},
      );
    }

    const phaseRes = await apiCall(
      page,
      'POST',
      `/api/guides/${placeId}/production-jobs/${jobId}/approve-phase`,
      { continue: true },
    );
    if (phaseRes.status !== 200) {
      fail('C-approve-phase', `approve-phase → ${phaseRes.status}`);
      return;
    }
    pass('C-approve-phase', 'Phase advanced to translation');

    const pumpComplete = await pumpUntil(
      page,
      async (p) => {
        const d = await apiCall(p, 'GET', `/api/guides/${placeId}/production-jobs/${jobId}`);
        const status = d.body?.job?.status;
        if (status === 'completed') return { done: true, status };
        if (status === 'failed') return { done: true, status, error: d.body?.job?.errorMessage };
        return { done: false, status };
      },
      'completed',
    );
    if (pumpComplete.status !== 'completed') {
      fail('C-completed', pumpComplete.error || `ended in ${pumpComplete.status}`);
      return;
    }
    pass('C-completed', 'Job completed after translation');

    await page.reload({ waitUntil: 'networkidle2' });
    await wait(2000);

    const startEnabledAfter = await isStartFullGuideDisabled(page);
    if (startEnabledAfter === false) {
      pass('C-b1-hasActiveJob', 'Start full guide enabled after completed (B1)');
    } else {
      fail('C-b1-hasActiveJob', `Start still disabled after completed: ${startEnabledAfter}`);
    }

    // --- D: Scoped stop start + cancel ---
    const stopPlay = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button[aria-label]')].find((b) => {
        const label = b.getAttribute('aria-label') || '';
        return label.includes('Producera stopp') || label.includes('Produce stop');
      });
      if (btn && !btn.disabled) {
        btn.click();
        return true;
      }
      return false;
    });
    if (!stopPlay) {
      fail('D-scoped-stop', 'Scoped stop play button not clickable');
    } else {
      await wait(500);
      const scopedForce = await page.$('#production-force');
      if (scopedForce) {
        await scopedForce.click();
      }
      (await clickByText(page, 'Start production')) ||
        (await clickByText(page, 'Starta produktion'));
      await wait(1500);
      const scopedJob = (
        await apiCall(page, 'GET', `/api/guides/${placeId}/production-jobs`)
      ).body?.find((j) =>
        ['pending', 'planning', 'processing', 'awaiting_review'].includes(j.status),
      );
      if (scopedJob?.type === 'stop') {
        pass('D-scoped-stop', `Stop-scoped job #${scopedJob.id} started`);
        jobId = scopedJob.id;
      } else {
        fail('D-scoped-stop', 'No active stop-scoped job');
      }

      const cancelClicked =
        (await clickByText(page, 'Cancel job')) ||
        (await clickByText(page, 'Avbryt jobb')) ||
        (await clickByText(page, 'Avbryt'));
      if (cancelClicked) {
        await wait(400);
        (await clickByText(page, 'Avbryt')) || (await clickByText(page, 'Cancel'));
        await wait(1500);
        const cancelled = await apiCall(
          page,
          'GET',
          `/api/guides/${placeId}/production-jobs/${jobId}`,
        );
        if (cancelled.body?.job?.status === 'cancelled') {
          pass('D-cancel', 'Job cancelled via UI');
        } else {
          fail('D-cancel', `Expected cancelled, got ${cancelled.body?.job?.status}`);
        }
      } else {
        await apiCall(page, 'POST', `/api/guides/${placeId}/production-jobs/${jobId}/cancel`, {});
        pass('D-cancel', 'Job cancelled via API fallback');
      }
    }

    // --- F: History ---
    const history = await apiCall(page, 'GET', `/api/guides/${placeId}/production-jobs`);
    if ((history.body || []).length >= 2) {
      pass('F-history', `${history.body.length} jobs in history`);
    } else {
      fail('F-history', `Expected ≥2 jobs, got ${(history.body || []).length}`);
    }

    // --- G: Conflict guard ---
    await apiCall(page, 'POST', `/api/guides/${placeId}/production-jobs`, { type: 'full_guide' });
    const secondStart = await apiCall(page, 'POST', `/api/guides/${placeId}/production-jobs`, {
      type: 'full_guide',
    });
    if (secondStart.status === 409) {
      pass('G-conflict', 'Second start returns 409');
      const active = (
        await apiCall(page, 'GET', `/api/guides/${placeId}/production-jobs`)
      ).body?.find((j) =>
        ['pending', 'planning', 'processing', 'awaiting_review'].includes(j.status),
      );
      if (active) {
        await apiCall(
          page,
          'POST',
          `/api/guides/${placeId}/production-jobs/${active.id}/cancel`,
          {},
        );
      }
    } else {
      fail('G-conflict', `Expected 409, got ${secondStart.status}`);
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
  console.log(failed === 0 ? '\n✅ PRODUCTION E2E GREEN\n' : '\n❌ PRODUCTION E2E FAILED\n');
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Smoke: create place → start English text_derivation → translation shells/job.
 * Mirrors Save and produce (API) + translation follow-up.
 *
 * Usage: node scripts/guides-save-and-produce-smoke.js
 * Requires: npm run dev:all (API :3002)
 */
const BASE = process.env.GUIDES_SMOKE_API_URL || 'http://localhost:3002';
const EMAIL = process.env.GUIDES_E2E_EMAIL || 'admin@homebase.se';
const PASSWORD = process.env.GUIDES_E2E_PASSWORD || 'admin123';

let cookie = '';
let csrf = '';
let failed = 0;

function pass(id, detail) {
  console.log(`  PASS ${id}: ${detail}`);
}
function fail(id, detail) {
  failed += 1;
  console.log(`  FAIL ${id}: ${detail}`);
}

async function req(method, path, body) {
  const headers = { 'Content-Type': 'application/json', Cookie: cookie };
  if (csrf && csrf !== 'csrf-disabled') headers['X-CSRF-Token'] = csrf;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.getSetCookie?.() || [];
  if (setCookie.length) {
    const jar = new Map(
      cookie
        .split('; ')
        .filter(Boolean)
        .map((c) => {
          const i = c.indexOf('=');
          return [c.slice(0, i), c.slice(i + 1)];
        }),
    );
    for (const raw of setCookie) {
      const [pair] = raw.split(';');
      const i = pair.indexOf('=');
      jar.set(pair.slice(0, i), pair.slice(i + 1));
    }
    cookie = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

async function main() {
  console.log(`Guides save-and-produce smoke @ ${BASE}`);

  const csrfRes = await req('GET', '/api/csrf-token');
  csrf = csrfRes.body?.csrfToken || '';
  if (!csrf) {
    fail('csrf', 'No csrf token');
    process.exit(1);
  }
  pass('csrf', 'token ok');

  const login = await req('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD });
  if (login.status !== 200) {
    fail('login', `${login.status} ${JSON.stringify(login.body)}`);
    process.exit(1);
  }
  pass('login', EMAIL);

  const name = `Smoke SaveProduce ${Date.now()}`;
  const create = await req('POST', '/api/guides', {
    displayName: name,
    sourceLanguage: 'en',
    lifecycleStatus: 'draft',
    place: {
      provider: 'manual',
      providerRef: null,
      displayName: 'Colosseum',
      formattedAddress: 'Piazza del Colosseo, Rome, Italy',
      coordinates: { lat: 41.8902, lng: 12.4922 },
      countryCode: 'IT',
      adminArea: 'Lazio',
      locality: 'Rome',
      placeTypes: ['attraction'],
      bbox: null,
      resolvedAt: new Date().toISOString(),
    },
    geographicReference: 'Rome, Italy',
  });
  if (create.status !== 201 && create.status !== 200) {
    fail('create', `${create.status} ${JSON.stringify(create.body)}`);
    process.exit(1);
  }
  const placeId = String(create.body.id);
  const sourceLang = (create.body.sourceLanguage || 'en').toLowerCase();
  if (sourceLang !== 'en') {
    fail('create-source-lang', `expected en got ${sourceLang}`);
  } else {
    pass('create', `place ${placeId} sourceLanguage=en`);
  }

  const produce = await req('POST', `/api/guides/${placeId}/production-jobs`, {
    type: 'full_guide',
    phases: ['text_derivation'],
    languages: ['en'],
  });
  if (produce.status !== 201 && produce.status !== 200) {
    fail('produce-source', `${produce.status} ${JSON.stringify(produce.body)}`);
  } else {
    const phases = produce.body?.job?.phases || produce.body?.phases;
    const jobId = produce.body?.job?.id || produce.body?.id;
    pass('produce-source', `job ${jobId} phases=${JSON.stringify(phases)}`);
    if (
      !Array.isArray(phases) ||
      !phases.includes('text_derivation') ||
      phases.includes('translation')
    ) {
      fail('produce-phases', `expected only text_derivation, got ${JSON.stringify(phases)}`);
    }
  }

  // Seed approved English text so translation can run without waiting for LLM HITL
  const seed = await req('PUT', `/api/guides/${placeId}/presentations/en`, {
    presentationText: 'The Colosseum is an ancient amphitheatre in the centre of Rome, Italy.',
    publicationStatus: 'ready',
  });
  if (seed.status !== 200) {
    fail('seed-en', `${seed.status} ${JSON.stringify(seed.body)}`);
  } else if (seed.body?.approvalStatus !== 'approved') {
    fail('seed-en-approval', `expected approved got ${seed.body?.approvalStatus}`);
  } else {
    pass('seed-en', `approval=${seed.body.approvalStatus}`);
  }

  const shell = await req('POST', `/api/guides/${placeId}/presentations`, { language: 'sv' });
  if (shell.status !== 201 && shell.status !== 200) {
    // may already exist
    if (shell.status === 409 || shell.body?.code === 'CONFLICT') {
      pass('shell-sv', 'already exists');
    } else {
      fail('shell-sv', `${shell.status} ${JSON.stringify(shell.body)}`);
    }
  } else {
    pass('shell-sv', `id=${shell.body?.id}`);
  }

  // Cancel active source job if still running so translation can start
  const jobs = await req('GET', `/api/guides/${placeId}/production-jobs`);
  if (jobs.status === 200 && Array.isArray(jobs.body)) {
    for (const job of jobs.body) {
      if (['pending', 'planning', 'processing', 'awaiting_review'].includes(job.status)) {
        await req('POST', `/api/guides/${placeId}/production-jobs/${job.id}/cancel`, {});
      }
    }
  }

  const translate = await req('POST', `/api/guides/${placeId}/production-jobs`, {
    type: 'full_guide',
    phases: ['translation'],
    languages: ['sv'],
  });
  if (translate.status !== 201 && translate.status !== 200) {
    fail('produce-translation', `${translate.status} ${JSON.stringify(translate.body)}`);
  } else {
    const phases = translate.body?.job?.phases || translate.body?.phases;
    const jobId = translate.body?.job?.id || translate.body?.id;
    pass('produce-translation', `job ${jobId} phases=${JSON.stringify(phases)}`);
    if (
      !Array.isArray(phases) ||
      !phases.includes('translation') ||
      phases.includes('text_derivation')
    ) {
      fail('translate-phases', `expected only translation, got ${JSON.stringify(phases)}`);
    }
  }

  // Cleanup: cancel leftover jobs (keep place for inspection unless SMOKE_DELETE=1)
  const jobs2 = await req('GET', `/api/guides/${placeId}/production-jobs`);
  if (jobs2.status === 200 && Array.isArray(jobs2.body)) {
    for (const job of jobs2.body) {
      if (['pending', 'planning', 'processing', 'awaiting_review'].includes(job.status)) {
        await req('POST', `/api/guides/${placeId}/production-jobs/${job.id}/cancel`, {});
      }
    }
  }
  if (process.env.SMOKE_DELETE === '1') {
    await req('DELETE', `/api/guides/${placeId}`);
    pass('cleanup', `deleted ${placeId}`);
  } else {
    pass('cleanup', `left place ${placeId} (set SMOKE_DELETE=1 to remove)`);
  }

  console.log(failed === 0 ? '\nSmoke OK' : `\nSmoke FAILED (${failed})`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

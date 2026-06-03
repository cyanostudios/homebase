#!/usr/bin/env node
/**
 * Smoke-test production system email readiness (health + forgot-password).
 *
 *   node scripts/verify-prod-system-email.js
 *   PROD_APP_URL=https://sweet-courtesy-production-fa4e.up.railway.app node scripts/verify-prod-system-email.js
 */
const base = (process.env.PROD_APP_URL || process.env.RAILWAY_APP_URL || '')
  .replace(/\/+$/, '')
  .trim();

const testEmail = process.env.TEST_EMAIL || 'user@homebase.se';

async function main() {
  if (!base) {
    console.error('Set PROD_APP_URL or RAILWAY_APP_URL to your Railway Homebase URL');
    process.exit(1);
  }

  console.log(`=== Verify system email: ${base} ===\n`);

  const healthRes = await fetch(`${base}/api/health`);
  const health = await healthRes.json().catch(() => ({}));
  console.log(`Health: HTTP ${healthRes.status}`);
  console.log('  systemEmail:', health.systemEmail ?? '(field missing — deploy health update)');
  console.log('  passwordReset:', health.passwordReset ?? '(field missing)');

  if (health.systemEmail && !health.systemEmail.configured) {
    console.log(
      '\n❌ systemEmail.configured is false — set RESEND_API_KEY + RESEND_FROM in Railway',
    );
  }

  const forgotRes = await fetch(`${base}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail }),
  });
  const forgotBody = await forgotRes.json().catch(() => ({}));
  console.log(`\nForgot-password: HTTP ${forgotRes.status}`);
  if (forgotRes.status === 200) {
    console.log('  ✅', forgotBody.message || 'OK');
    if (forgotBody.devLink) {
      console.log('  devLink:', forgotBody.devLink);
    }
  } else {
    console.log('  ❌', forgotBody.error || forgotBody.code || JSON.stringify(forgotBody));
    if (forgotBody.code === 'EMAIL_NOT_CONFIGURED') {
      console.log('\n→ Add RESEND_API_KEY and RESEND_FROM in Railway Variables, then redeploy.');
      console.log('→ Run: npm run print:mail-resend-hints');
    }
  }

  process.exit(forgotRes.status === 200 ? 0 : 1);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

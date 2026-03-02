# Säkerhetschecklista för launch

**Status:** Delvis genomförd. Kritiska risker adresserade. Övrigt under To-do vid prod.

---

## ✅ Genomfört

### 1. CSRF-skydd aktiverat

- `server/core/middleware/csrf.js` – CSRF är påslaget.
- Muterande routes med `csrfProtection`: files, estimates, invoices, notes, tasks, orders, products, cdon, fyndiq, shipping, channels, woocommerce-products.
- Contacts har nu csrfProtection på alla muterande routes. TimeTrackingWidget använder contactsApi.createTimeEntry() för CSRF.

### 2. SESSION_SECRET – inget fallback i produktion

- `server/index.ts` – `REQUIRED_PRODUCTION_ENV` inkluderar `SESSION_SECRET` och kastar vid start om det saknas.
- Session-config kastar också om `SESSION_SECRET` saknas i prod.

### 3. Admin – ingen exponering av connection string

- `server/core/routes/admin.js` – `/tenants` returnerar `neon_project_id`, `neon_database_name` (inte `neon_connection_string`).

### 4. Loggning – inga känsliga params

- `server/core/services/database/adapters/PostgreSQLAdapter.js` – loggar `sql`, `userId`, `paramCount` (inte `params`).

### 5. Kryptering av lagrade credentials

- `CredentialsCrypto.js` – krypterar/dekrypterar med `CREDENTIALS_ENCRYPTION_KEY`.
- Används av: mail (auth_pass, resend_api_key), shipping, cloudStorage, cdon, fyndiq, woocommerce-products, channels.
- `CREDENTIALS_ENCRYPTION_KEY` krävs i produktion (`REQUIRED_PRODUCTION_ENV`).

### 6. Webhook – rate limit + timing-safe compare

- `/api/intake/inspection-request` – `intakeLimiter`, `safeSecretEquals`, secret-check via `x-webhook-secret`.

### 7. Filuppladdning (files) – magic-byte scanning

- `plugins/files/routes.js` – `FileType.fromBuffer`, `validateUploadedFilesByMagicBytes` validerar innehåll efter upload.
- Produktimport (`/api/products/import`) har ännu inte magic-byte – admin-only, lägre prioritet.

### 8. MFA (tvåfaktorsautentisering)

- TOTP/authenticator, per användare i Settings → Security.
- `MFA_ENABLED` env – av i dev, på i prod.
- Filer: auth.js, mfaService.js, 054-user-mfa.sql, SecuritySettingsForm, LoginComponent.

### 9. Session – idle timeout (endast prod)

- `server/index.ts` – i prod: `rolling: true`, cookie `maxAge` = `SESSION_IDLE_TIMEOUT_MINUTES` (default 15). Efter X min inaktivitet → utloggning.
- I dev: ingen idle timeout (24h session).

---

## To-do vid prod

Punkter som görs **vid produktion / launch** – kod är klar; övrigt är operativt/infra.

1. **CSP – stärk i prod**
   - Nuvarande: `'unsafe-inline'` på scripts/styles (samma i dev och prod).
   - Åtgärd: I prod – nonce-baserad CSP (ta bort `unsafe-inline`). I dev – behåll nuvarande.
   - Implementering: `if (NODE_ENV === 'production')` → strängare CSP med nonce; annars → nuvarande.

2. **Webhook – IP allowlist**
   - Åtgärd: Begränsa `/api/intake/inspection-request` till kända CF7-IP:er.
   - Implementering: `CF7_WEBHOOK_IP_ALLOWLIST` (komma-separerade IP:er). Om satt → avvisa requests från andra IP:er (403). Om ej satt → ingen filtrering.
   - Sätts endast i prod (där CF7-IP:erna är kända).

3. **Rate limit – Redis vid flera instanser**
   - Idag: Inbyggt memory store (process-lokal).
   - Åtgärd: Om du kör flera instanser (horizontal scaling) i prod – använd Redis-backed store (t.ex. `rate-limit-redis`). Vid en instans räcker memory store.

4. **Auth – login lockout / step-up**
   - Åtgärd: Efter X misslyckade inloggningar (t.ex. 5) – lockout i N minuter eller CAPTCHA/step-up.
   - Implementering: Räknar misslyckade försök per IP (eller per användarnamn). Ingen fallback – avvisa vid lockout. Kräver policy (antal försök, lockout-tid).
   - Dev: Påverkar bara när man failar inloggning många gånger.

5. **Infra – Rotera alla secrets före launch**
   - DB, SMTP, API-nycklar, SESSION_SECRET, CREDENTIALS_ENCRYPTION_KEY, webhook-secret. Ny värden endast för prod.

6. **Infra – Backup + restore-test**
   - Säkerhetskopiera prod (DB, filer); testa att återställningen fungerar.

7. **Övervakning**
   - Säkerhetsloggning, alarm på bruteforce / 5xx-spikes.

---

## Kryptering (referens)

**In transit:** HTTPS/TLS, tvinga i reverse proxy, `sslmode=require` för DB.  
**At rest:** DB-kryptering hos provider, SSE för objektlagring, CredentialsCrypto för API/SMTP-nycklar (✅ implementerat).

---

## Launchordning (nästa steg)

1. ✅ CSRF
2. ✅ SESSION_SECRET
3. ✅ Admin connection string
4. ✅ SQL-params loggning
5. ✅ Credentials-kryptering
6. ✅ Filuppladdning magic-byte (files-plugin)
7. ✅ MFA
8. ✅ CSRF för contacts – csrfProtection på alla muterande routes; TimeTrackingWidget använder contactsApi.
9. Se plan: `.cursor/to_do_security_plan_next.md` – kräver dina beslut (CSP, IP allowlist, Redis, lockout).

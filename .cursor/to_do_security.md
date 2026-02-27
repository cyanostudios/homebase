**User**

om jag snart vill lansera en version av appen, vad kan jag göra för att öka säkerheten? Vad ska jag tänka på nu? Kolla på alla möjligt hot som finns. Intrång i appen, databasen osv, krypterad eller okrypterad data fram och tillbaka, ALLT som har med säkerhet att göra

---

**Cursor**

Bra fråga. Jag gör en snabb men bred säkerhetsinventering av koden (server, auth, session, CORS, rate limit, DB, filuppladdning, secrets, headers) och ger dig en konkret launch-checklista med högsta riskerna först.

Bra att du tar detta **innan launch**. Utifrån koden är det här din säkerhetsbild just nu, med fokus på intrång, databas, kryptering och dataflöden.

## Kritiska risker (fixa före release)

- **CSRF-skydd är i praktiken avstängt globalt**  
  Det här är den största webbrisk just nu (session-cookie + state-changing endpoints utan CSRF).
```16:39:server/core/middleware/csrf.js
// TEMPORARILY DISABLED FOR DEBUGGING
let csrfProtection;
if (false && csrf) { // Disabled: change false to true to re-enable
  csrfProtection = csrf({
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    },
  });
} else {
  // CSRF protection disabled for debugging
  csrfProtection = (req, res, next) => {
    // No-op middleware - CSRF protection disabled
    next();
  };
}

// ... Returns a dummy token
res.json({ csrfToken: 'csrf-disabled' });
```

- **Flera routes har CSRF bortkommenterat**
```148:193:plugins/files/routes.js
router.post('/',
  gate,
  /* csrfProtection, */ // Temporarily disabled
...
router.post('/upload',
  gate,
  uploadLimiter,
  /* csrfProtection, */ // Temporarily disabled
```

- **Fallback-session secret i runtime-kod**  
  Om env missas i prod kan appen starta med osäkert secret.
```95:103:server/index.ts
secret: process.env.SESSION_SECRET || 'homebase-dev-secret-change-in-production',
cookie: {
  secure: process.env.NODE_ENV === 'production',
  httpOnly: true,
  maxAge: 24 * 60 * 60 * 1000,
  sameSite: 'lax',
},
```

- **Admin endpoint returnerar tenant connection strings**  
  Det är mycket känslig data (DB-host/credentials i URL).
```80:89:server/core/routes/admin.js
SELECT u.id, u.email, u.role, t.neon_project_id, t.neon_database_name, t.neon_connection_string
...
res.json({ tenants: result.rows });
```

- **Känsliga credentials lagras i klartext i DB-tabeller** (mail auth_pass, resend_api_key, shipping api_secret, cdon/fyndiq api_secret, cloud client_secret).  
  Kräver skydd på applager + strikt DB access.

---

## Hög prioritet (nästa steg direkt efter kritiska)

- **Loggning läcker potentiellt känsliga parametrar** (SQL params loggas).
```200:206:server/core/services/database/adapters/PostgreSQLAdapter.js
this.logger?.info('Executing SQL query', {
  sql: finalSql,
  params: finalParams,
  userId: userId,
  paramCount: finalParams.length,
});
```
  Risk: API-nycklar/lösenord hamnar i loggar.

- **CSP är för svag p.g.a. `'unsafe-inline'` på scripts/styles**  
  Ökar impact vid XSS.

- **Filuppladdning validerar MIME-type från klient**  
  Bra start, men bör kompletteras med magic-byte scanning (inte bara `file.mimetype`).

- **Publik webhook saknar extra skydd** (`/api/intake/inspection-request`)  
  Har secret-check (bra), men lägg på IP allowlist + rate limit + timing-safe compare.

- **Rate limit är process-lokal (memory store)**  
  Vid flera instanser behöver du Redis-backed limiter, annars lätt att kringgå per node.

---

## Kryptering: vad du ska kräva

### In transit
- **All trafik via HTTPS/TLS 1.2+** (frontend↔backend, backend↔DB, backend↔S3/R2, webhookkällor).  
- Tvinga HTTPS + HSTS i reverse proxy.
- Säkerställ att `DATABASE_URL` använder SSL (t.ex. `sslmode=require`/motsv på provider).

### At rest
- DB-kryptering via provider (Neon/cloud) + backup-kryptering.
- Objektlagring med SSE (S3/R2 server-side encryption).
- **Applikationskryptera särskilt känsliga hemligheter** innan DB-lagring (API secrets, SMTP pass etc.), med nyckel i secrets manager.

---

## Auth / konto / session (best practice för launch)

- Aktivera CSRF fullt.
- Tvinga stark `SESSION_SECRET` (fail-fast om saknas i prod).
- Kortare session-liv + idle timeout för adminkonton.
- Login-skydd: lockout/step-up efter många försök, ev. CAPTCHA.
- Lägg till **MFA för admin/superuser**.
- Email verification + password reset med signed, short-lived tokens.
- Undvik att exponera intern infrastrukturdata via admin-API (särskilt connection strings).

---

## Databas- och infra-härdning

- Minsta privilegium på DB-användare (separera app user/migration user).
- Stäng all direkt DB-exponering mot internet om möjligt (allowlist/VPC).
- Rotera alla secrets före launch: DB, SMTP, API-nycklar, session secret, webhook secret.
- Automatisk backup + restore-test (inte bara backup finns).

---

## Övervakning och incidentberedskap

- Sätt upp:
  - säkerhetsloggning (auth fail, rate-limit hits, admin actions, webhook failures)
  - central logg med sekretessmaskning
  - larm på ovanliga mönster (bruteforce, stora batch deletes, 5xx spikes)
- Ha enkel incident-playbook:
  - rotera keys
  - tvinga logout (invalidate sessions)
  - blockera IP/rutter tillfälligt
  - återställ från backup

---

## Rekommenderad launchordning (praktisk)

1. **Re-enable CSRF** + verifiera alla muterande routes.  
2. **Ta bort fallback secrets** (SESSION_SECRET måste finnas i prod).  
3. **Stoppa exponering av `neon_connection_string` i API-svar.**  
4. **Maskera/ta bort loggning av känsliga params.**  
5. **Inför kryptering av lagrade credentials** + secret rotation.  
6. **Stärk upload/webhook/rate-limit** (magic bytes, IP allowlist, Redis limiter).  
7. **MFA för admin + incident/backup-test.**

Om du vill kan jag i nästa steg göra en **konkret “go-live security checklist”** med exakta acceptanskriterier per punkt (så ni kan bocka av inför release).

---
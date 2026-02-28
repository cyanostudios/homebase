# Plan: Nästa säkerhetssteg

**Principer:** Best practice, inga fallbacks/workarounds, fråga vid tvekan, dev-först (inga ändringar som försvårar dev).

---

## Nuläge

- **Files-upload** – har redan magic-byte scanning (`FileType.fromBuffer`, `validateUploadedFilesByMagicBytes`). ✅
- **Products import** – multer utan file filter, ingen magic-byte. Låg prioritet (admin-only, parser kraschar på fel format).

---

## Steg 1: Filuppladdning – produkter (valfritt)

**Åtgärd:** Lägg till magic-byte-validering för `/api/products/import` (CSV/XLSX).

- **Fördel:** Konsekvent med files-upload.
- **Dev:** Påverkar inte – samma API, samma format.
- **Fråga:** Vill du att vi gör detta nu, eller prioritera andra punkter? Produktimport är admin-only.

---

## Steg 2: CSP – `unsafe-inline`

**Nuvarande:** `scriptSrc` och `styleSrc` tillåter `'unsafe-inline'` (krävs av många SPAs).

**Åtgärd:** Nonce-baserad CSP – nonce per request, injicera i HTML/scripts.

- **Dev:** Kräver att Vite/build matar nonce till script-taggar. Kan göra dev-setup mer komplex (SSR eller proxy som injectar nonce).
- **Fråga:** Hur är appen byggd? Ren SPA med statisk HTML? Om ja – nonce kräver att servern levererar HTML med nonce i script-taggar. Om du använder Vite dev server med separat API, blir integrationen krångligare.
- **Rekommendation:** Skippa CSP-hårdning tills du har tydlig SPA-arkitektur eller SSR. Risken är låg om XSS-skydd redan finns (React escape, inga `dangerouslySetInnerHTML`).

**Fråga till dig:** Vill du att jag undersöker hur CSP skulle kunna införas utan att försvåra dev? Eller stryk CSP tills vidare?

---

## Steg 3: Webhook – IP allowlist

**Åtgärd:** Begränsa `/api/intake/inspection-request` till kända CF7-IP:er (om möjligt).

- **Krav:** Du måste ha en lista med tillåtna IP-adresser eller IP-intervall från CF7/Contact Form 7.
- **Implementering:** `CF7_WEBHOOK_IP_ALLOWLIST` (t.ex. komma-separerad lista) – om satt, avvisa förfrågningar från andra IP:er. Inget fallback – om listan saknas, ingen IP-filtrering (nuvarande beteende).
- **Dev:** I dev kan du sätta `CF7_WEBHOOK_IP_ALLOWLIST` till `127.0.0.1` om du testar lokalt, eller lämna tomt för att inte filtrera.

**Fråga till dig:** Har du tillgång till CF7:s IP-adresser (eller IP-range)? Om nej – hoppa över detta steg.

---

## Steg 4: Rate limit – Redis

**Nuvarande:** Inbyggd memory store (process-lokal). Vid flera instanser delas inte limit mellan noder.

- **Åtgärd:** Använd Redis-backed store (t.ex. `rate-limit-redis`).
- **Dev:** Kräver att Redis körs lokalt, eller ny env `REDIS_URL`. Ingen fallback – om `REDIS_URL` saknas i prod, kasta fel. I dev: samma – Redis måste finnas.
- **Fråga:** Kör du redan Redis i dev? Planerar du flera serverinstanser snart? Om du kör single-instance i både dev och prod kan Redis vara överdrivet just nu.

**Fråga till dig:** Skalar du horizontalt inom kort (flera noder)? Om nej – behåll memory store tills vidare. När du behöver Redis, lägg då till `REDIS_URL` och Redis-backed limiter.

---

## Steg 5: Auth – login lockout / step-up

**Åtgärd:** Efter X misslyckade inloggningar (t.ex. 5) – lockout i N minuter eller CAPTCHA/step-up.

- **Implementering:** Räknar misslyckade försök per IP (eller per användarnamn om du vill). Ingen fallback – avvisa vid lockout.
- **Dev:** Påverkar bara när du failar inloggning många gånger. Kan göra lokala tester lite mer krångliga om du låser dig själv.

**Fråga till dig:** Vill du ha lockout nu, eller vänta tills närmare launch?

---

## Rekommenderad ordning (utan beslut från dig)

1. **Skippa CSP** tills SPA/SSR-upplägg är klart.
2. **Skippa Redis** tills du kör flera instanser.
3. **Skippa IP allowlist** tills du har CF7:s IP-lista.
4. **Skippa produkter magic-byte** om du inte vill prioritera det.
5. **Lockout** – kan göras när du vill, men kräver en policy (antal försök, lockout-tid).

---

## Vad jag behöver från dig

1. **CSP:** Ska vi undersöka nonce-lösning nu, eller skippa?
2. **IP allowlist:** Har du CF7:s IP-adresser?
3. **Redis:** Planerar du flera instanser snart?
4. **Produkter import:** Ska magic-byte läggas till?
5. **Login lockout:** Vilket antal misslyckade försök och hur lång lockout (eller skippa tills vidare)?

---

## Sammanfattning

Inga större kodändringar föreslås innan du svarat. De återstående punkterna kräver dina beslut (CSP-arkitektur, IP-lista, Redis, lockout-policy) för att undvika fallbacks och onödig komplexitet i dev.

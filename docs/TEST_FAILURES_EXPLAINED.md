# Förklaring av övriga testfel

Detta dokument beskriver de 12 testfel som uppstår när hela testsviten körs (`npm test`). Dessa fel är **inte** relaterade till ändringarna i "Sello ID som products.id".

---

## 1. MockAdapters (1 fel)

**Fil:** `server/core/services/__tests__/MockAdapters.test.js`  
**Test:** `should throw error when updating non-existent record`

**Fel:** `AppError is not a constructor`

**Orsak:** `MockAdapter` importerar `AppError` felaktigt:

```javascript
// MockAdapter.js rad 5
const AppError = require('../../../errors/AppError');
```

`AppError.js` exporterar `module.exports = { AppError }`, så `require()` returnerar ett objekt `{ AppError }`. Variabeln `AppError` blir då hela objektet, inte konstruktorn. `throw new AppError(...)` försöker anropa `new` på ett objekt, vilket ger felet.

**Åtgärd:** Ändra till `const { AppError } = require('../../../errors/AppError');` i `MockAdapter.js`.

---

## 2. ProviderSwitching (6 fel)

**Fil:** `server/core/services/__tests__/ProviderSwitching.test.js`  
**Fel:** `Unknown tenant provider: neon`

**Orsak:** Testerna sätter `process.env.TENANT_PROVIDER = 'local'` (eller andra värden), men `ServiceManager` använder fortfarande `neon`. Det beror på:

1. **Env-återställning:** `afterEach` gör `process.env = originalEnv`. I Node.js är `process.env` ett speciellt objekt och att ersätta det helt kan ge oväntat beteende. Tester som körs tidigare kan ha satt `TENANT_PROVIDER=neon`, och återställningen fungerar inte som tänkt.

2. **Provider-krav:** `NeonTenantProvider` kräver `NEON_API_KEY`. Om den inte är satt får `ServiceManager` ett fel när den initieras.

3. **Tester som kräver `local`:** För `TENANT_PROVIDER=local` behövs `LocalTenantProvider` och `DATABASE_URL`. Om andra tester körs efteråt och inte sätter `TENANT_PROVIDER` korrekt, kan `neon` användas igen.

**Åtgärd:** Säkerställ att varje test sätter env-variabler innan `ServiceManager.initialize()` och att återställningen fungerar (t.ex. `process.env.TENANT_PROVIDER = originalEnv.TENANT_PROVIDER` i stället för att ersätta hela `process.env`). Alternativt kan `ServiceManager` mockas för dessa tester.

---

## 3. phase1Validators (2 fel)

**Fil:** `server/__tests__/phase1Validators.test.js`  
**Tester:** `accepts valid update_article_price action`, `rejects price action when original_price is missing`

**Fel:**

- Förväntat: `{ ok: true }` eller `reason: 'missing_original_price_rows'`
- Faktiskt: `reason: 'invalid_article_id'`

**Orsak:**  
`validateFyndiqUpdateArticlePriceAction` anropar `validateFyndiqUpdateActionEnvelope`, som kräver att `action.id` är ett giltigt UUID v4:

```javascript
// plugins/fyndiq-products/controller.js rad 595–597
const uuidV4Like = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
if (!uuidV4Like.test(id)) {
  return { ok: false, reason: 'invalid_article_id' };
}
```

Testerna använder `id: 123`, vilket inte matchar ett UUID. Valideringen misslyckas med `invalid_article_id` innan `original_price` eller prislogiken kontrolleras.

**Åtgärd:** Ändra till ett giltigt UUID i testerna, t.ex. `id: '550e8400-e29b-41d4-a716-446655440000'`.

---

## 4. notes.test (1 fel – suite körs inte)

**Fil:** `server/plugins/notes/__tests__/notes.test.js`  
**Fel:** `Cannot find module '../model' from 'server/plugins/notes/__tests__/notes.test.js'`

**Orsak:**  
Testet förväntar sig `server/plugins/notes/model.js`, men `notes`-modellen ligger i `plugins/notes/model.js` (projektrot). Det finns ingen `plugins/notes/`-katalog under `server/`.

**Åtgärd:** Uppdatera importen:

```javascript
// Från
const NotesModel = require('../model');

// Till
const NotesModel = require('../../../../plugins/notes/model');
```

---

## 5. Intake (2 fel)

**Fil:** `server/core/routes/__tests__/intake.test.js`  
**Fel:** Timeout (5000 ms) och `Unknown tenant provider: neon`

**Orsak:**  
Intake-testerna startar en Express-app som använder `ServiceManager` och därmed `NeonTenantProvider`. När `NEON_API_KEY` saknas eller tenant-providern inte fungerar:

1. `Logger` eller andra tjänster anropar `ServiceManager.get()`, vilket initierar `ServiceManager`.
2. `ServiceManager` försöker ladda `NeonTenantProvider` utan `NEON_API_KEY` och får fel.
3. Felet leder till att anropet hänger eller timeout.

**Åtgärd:**  
Mocka `ServiceManager` eller sätt `NEON_API_KEY` (och eventuellt `TENANT_PROVIDER`) i testmiljön. Alternativt kan intake-routen mockas så att den inte använder riktiga tjänster.

### Kan man använda riktig NEON_API_KEY i tester?

**Tekniskt:** Ja – sätt `NEON_API_KEY` i `.env` eller `process.env` innan testerna körs.

**Risker:**

- **Riktiga API-anrop** – testerna pratar mot Neon och kan skapa/ändra data
- **Kostnad** – Neon debiterar per användning
- **Sårbarhet** – API-nyckeln hamnar i testloggar eller CI
- **Instabilitet** – nätverk, rate limits och timeout kan göra testerna flaky

**Rekommendation:** Använd mockar eller `TENANT_PROVIDER=local` med lokal databas i stället för riktig `NEON_API_KEY` i tester.

---

## Sammanfattning

| Fil                       | Antal fel | Huvudorsak                                      |
| ------------------------- | --------- | ----------------------------------------------- |
| MockAdapters.test.js      | 1         | Felaktig import av `AppError`                   |
| ProviderSwitching.test.js | 6         | `process.env`-återställning och tenant-provider |
| phase1Validators.test.js  | 2         | Fyndiq `id` måste vara UUID                     |
| notes.test.js             | 1         | Felaktig sökväg till notes-modellen             |
| intake.test.js            | 2         | Saknad `NEON_API_KEY` och timeout               |

---

## Tester som körs utan problem

- `sello-id-as-products.test.js` – 27 tester
- `phase2ContractValidators.test.js` – 18 tester
- `security.test.js` – 6 tester

---

## Rekommenderad ordning för åtgärder

1. **MockAdapter:** Ändra `AppError`-importen.
2. **phase1Validators:** Använd giltigt UUID i Fyndiq-testerna.
3. **notes.test:** Rätt sökväg till notes-modellen.
4. **ProviderSwitching:** Justera env-hantering och återställning.
5. **Intake:** Mocka eller konfigurera `ServiceManager`/tenant-provider för testmiljön.

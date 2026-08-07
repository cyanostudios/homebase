# ADR — Shared QR capability (core)

**Status:** Accepted (Grind 1). **QA Approved** + **Security Approved**. Residualrisker AR-1–AR-3 dokumenterade — **väntar TPM medvetet godkännande**. **Local-first; ej prod-release** utan explicit beslut.  
**Datum:** 2026-08-07  
**Scope:** Generisk QR + Swish statisk Type C. Ingen commerce/token-API. Clubdesk Info är första admin-konsument (separat wiring; se Etapp 1 ADR).

**Relaterat:** Clubdesk Info Swish-kort konsumerar denna kapabilitet — se [`CLUBDESK_PLUGIN_ETAPP1.md`](CLUBDESK_PLUGIN_ETAPP1.md).

---

## Sammanfattning

QR-generering är en **plattformskapabilitet i client core** (`client/src/core/qr/`), inte ett produktplugin. Andra plugins importerar `@/core/qr` för Swish Type C-payload och/eller generisk QR (PNG data URL). **Clubdesk** konsumerar kapabiliteten via **Swish-profiler** (admin; se [`CLUBDESK_SWISH_PROFILES.md`](CLUBDESK_SWISH_PROFILES.md)).

---

## Beslut

| Beslut             | Val                                                                | Motivering                                                                                    |
| ------------------ | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Placering          | `client/src/core/qr/`                                              | Samma mönster som tabular import/export — utility utan domän-CRUD                             |
| Eget plugin        | Nej                                                                | Scope = delad kapabilitet; plugin skulle tvinga enablement utan affärsvärde                   |
| Nytt `packages/qr` | Nej (Grind 1)                                                      | Ingen Node/backend-konsument än; extrahera senare vid behov                                   |
| Bibliotek          | npm `qrcode`                                                       | Node (Jest) + browser; tunn React-yta ovanpå                                                  |
| Default render     | PNG data URL + `<img>`                                             | Undvik SVG-as-HTML XSS                                                                        |
| HTTP/DB            | Ingen                                                              | Offline encode endast                                                                         |
| Swish-format       | Type C: `C{payee};{amount};{message};{lock_mask}`                  | Matchar [Swish marknads-QR](https://www.swish.nu/marknadsmaterial/qr-generator) / design spec |
| Belopp             | Komma + 2 decimaler; när angivet måste avrundat öre-värde vara ≥ 1 | Spec; avvisa sub-öre som blir `0,00`                                                          |
| Meddelande         | Ersätt `;` → mellanslag, cap 50, `encodeURIComponent`              | Spec-delimiter + URL-encode                                                                   |
| Lock mask          | Bitmask 0–7; default `0`                                           | payee=1, amount=2, message=4                                                                  |

---

## Konsumtions-API

```ts
import {
  parseSwishNumber,
  buildSwishTypeCPayload,
  generateQrDataUrl,
  QrCode,
  SWISH_LOCK,
} from '@/core/qr';

const payee = parseSwishNumber('070-123 45 67');
if (!payee.ok) throw new Error(payee.error);

const payload = buildSwishTypeCPayload({
  payee: payee.value,
  amount: 100,
  message: 'Faktura 1',
  lockMask: 0,
});
if (!payload.ok) throw new Error(payload.error);

const dataUrl = await generateQrDataUrl(payload.value);
// or: <QrCode value={payload.value} size={256} alt="Swish QR" />
```

### Moduler

| Path           | Roll                                   |
| -------------- | -------------------------------------- |
| `@/core/qr`    | Public barrel                          |
| `swishNumber`  | Normalize / validate / classify        |
| `swishPayload` | Type C builder                         |
| `generateQr`   | Generic encode (data URL / SVG string) |
| `QrCode`       | Minimal React `<img>` wrapper          |

---

## Avvisade alternativ

| Alternativ                               | Varför                                                  |
| ---------------------------------------- | ------------------------------------------------------- |
| Plugin `swish` / `qr`                    | Opt-in gate för ren utility; onödigt när QR är core     |
| `@homebase/core` SDK                     | Fel concern (Plugin SDK)                                |
| Swish commerce/token (typ D)             | Utanför Grind 1; kräver Swish-avtal                     |
| Clubdesk-integration i shared-QR Grind 1 | Medvetet senare; inkopplad 2026-08-07 (Info Swish-kort) |

---

## Säkerhet

- Ingen HTTP-yta → ingen CSRF/auth-yta i Grind 1.
- Validera payee/amount/message innan encode (belopp måste ge ≥ 1 öre efter avrundning).
- Soft max payload 500 tecken.
- SVG-API finns men ska **inte** injiceras via `dangerouslySetInnerHTML` utan Security-granskning; default är data URL.

### Accepterade residualrisker (Security Approved)

Kräver **TPM medvetet godkännande** innan residualerna räknas som stängda i workflow-record.

| ID   | Risk                                 | Mitigation / acceptans                                                 |
| ---- | ------------------------------------ | ---------------------------------------------------------------------- |
| AR-1 | Misuse av exporterad `generateQrSvg` | Dokumenterad; default UI = PNG+`<img>`; ingen nuvarande HTML-injektion |
| AR-2 | npm `qrcode` supply chain            | Lockfile; ingen känd package-scoped CVE vid granskning                 |
| AR-3 | Obegränsad `width`/`size`            | Låg client-only resursrisk; valfri cap senare                          |

---

## Tester

`npx jest --testPathPattern=client/src/core/qr`

- `swishNumber.test.ts` — normalisering, `+46`, accept/reject
- `swishPayload.test.ts` — golden C-payload, encoding, lock mask
- `generateQr.test.ts` — PNG data URL, SVG, empty/oversized reject

---

## Konsekvenser

- Clubdesk Info Swish-flik konsumerar `@/core/qr` via **Swish-profiler** (persistens i `clubdesk_swish_profiles`; publik yta exponerar aldrig swish i Grind 1).
- Framtida Node (PDF/e-post) kan extrahera rena TS-moduler till `packages/qr`.

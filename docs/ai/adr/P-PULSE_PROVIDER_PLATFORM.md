# ADR — P-PULSE: Pulse Provider Platform (multi-provider + routing)

**Status:** Implementerad lokalt (v1). **QA Approved** + **Security Approved** (inkl. migration `165` / `sms_enabled` 2026-09-23). Residual **A1** väntar TPM medvetet godkännande. **Ej prod-release.**  
**Epic:** P-PULSE-PROVIDERS  
**Relaterad:** [`P-AI-SETTINGS_PROVIDER_CONFIGURATION.md`](P-AI-SETTINGS_PROVIDER_CONFIGURATION.md) (mönsterkälla; delade tabeller/API används **inte**)  
**Datum:** 2026-08-10

---

## Sammanfattning

Pulse går från en flat `pulse_settings`-rad (`active_provider` + Twilio-kolumner) till samma **katalog + credentials-rader + global/per-plugin routing**-modell som AI Providers, men **lokalt i pluginet `pulses`**.

**v1 send:** endast `twilio` (Programmable Messaging) och `mock`.  
**v1 katalog (credentials/CRUD, ingen SMS-send):** `twilio-verify`, `stytch` ([stytch.com](https://stytch.com/) — auth/OTP).

---

## Beslut

| Beslut             | Val                                                                            | Motivering                                                                 |
| ------------------ | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Scope              | Pulse-lokal plattform, inte `ai-providers`                                     | SMS/OTP ≠ AI credentials; undvik blandad super-plugin                      |
| Lagring            | `pulse_provider_settings` + `pulse_provider_routing`                           | Paritet med AI-tabeller; per `user_id` + key/scope                         |
| Secrets            | `secret_primary`, `secret_secondary` + `options` JSONB                         | Katalogdrivna fält; inga Twilio-specifika kolumnnamn                       |
| Capabilities       | `smsNotificationCapable` / `verifyCapable`                                     | Separata katalognycklar per tjänst; routing filtrerar SMS                  |
| Routing precedence | plugin → global `*` → legacy preferred enabled SMS → fail-closed               | Samma som `AIProviderRouter`                                               |
| Routable plugins   | **Enabled tenant plugins** (from session) + per-plugin `sms_enabled` switch    | Replaces hardcoded `pulses`/`contacts`/`slots` allowlist (migration `165`) |
| Legacy             | Backfill från `pulse_settings`; runtime läser endast nya tabeller              | Undvik dubbel sanning                                                      |
| Hemligheter        | Klartext i tenant-DB; maskerad i API                                           | Accepterad risk A1 (paritet mail/AI/pulses)                                |
| Mail               | Separat epic — se [`P-MAIL_PROVIDER_PLATFORM.md`](P-MAIL_PROVIDER_PLATFORM.md) | Explicit TPM-scope                                                         |

---

## Katalog (v1)

| `provider_key`  | Capabilities             | Send adapter   |
| --------------- | ------------------------ | -------------- |
| `twilio`        | `smsNotificationCapable` | Ja             |
| `mock`          | `smsNotificationCapable` | Ja             |
| `twilio-verify` | `verifyCapable`          | Nej (deferred) |
| `stytch`        | `verifyCapable`          | Nej (deferred) |

SMS-routing (`PUT /providers/routing*`) och `sendSmsWithUserSettings` accepterar **endast** `smsNotificationCapable` providers.

---

## Datamodell

Migration: `server/migrations/124-pulse-provider-platform.sql` (settings + routing base). Enablement columns: `165-pulse-plugin-sms-enabled.sql`.

### `pulse_provider_settings`

| Kolumn                      | Typ                            | Kommentar                                     |
| --------------------------- | ------------------------------ | --------------------------------------------- |
| `id`                        | SERIAL PK                      |                                               |
| `user_id`                   | INT NOT NULL                   |                                               |
| `provider_key`              | VARCHAR(50) NOT NULL           | Katalogwhitelist                              |
| `enabled`                   | BOOLEAN NOT NULL DEFAULT FALSE |                                               |
| `secret_primary`            | TEXT                           | t.ex. Account SID / Stytch project id         |
| `secret_secondary`          | TEXT                           | t.ex. Auth Token / Stytch secret              |
| `options`                   | JSONB NOT NULL DEFAULT `{}`    | Icke-hemliga fält (fromNumber, serviceSid, …) |
| `created_at` / `updated_at` | TIMESTAMP                      |                                               |
| UNIQUE                      | `(user_id, provider_key)`      |                                               |

### `pulse_provider_routing`

| Kolumn                      | Typ                                  | Kommentar                                                                |
| --------------------------- | ------------------------------------ | ------------------------------------------------------------------------ |
| `id`                        | SERIAL PK                            |                                                                          |
| `user_id`                   | INT NOT NULL                         |                                                                          |
| `scope`                     | VARCHAR(100) NOT NULL                | `*` (global) eller plugin key                                            |
| `provider_key`              | VARCHAR(50) **NULL allowed** (165)   | Global: required SMS-capable. Plugin: NULL = inherit global when enabled |
| `sms_enabled`               | BOOLEAN NOT NULL DEFAULT FALSE (165) | Per-plugin Pulse on/off. Global `*` always treated as on in app          |
| `created_at` / `updated_at` | TIMESTAMP                            |                                                                          |
| UNIQUE                      | `(user_id, scope)`                   |                                                                          |

Migrations: `124-pulse-provider-platform.sql` (base) + `165-pulse-plugin-sms-enabled.sql` (`sms_enabled`, nullable plugin `provider_key`, backfill legacy `pulses`/`contacts`/`slots` as enabled). Script: `npm run migrate:pulses` (`scripts/run-pulses-migration.js` includes 165).

**Send contract:** resolve requires `sms_enabled` for the plugin scope (missing/false → fail-closed). Empty session plugin list is treated as non-HTTP/internal; HTTP save paths validate `pluginKey` against `session.user.plugins`.

Inget `model`-fält (SMS har inte AI-modeller).

### Legacy backfill

Från `pulse_settings`:

1. Om Twilio-credentials finns → upsert `twilio` settings (`secret_primary`/`secret_secondary`/`options.fromNumber`, `enabled=true`).
2. Alltid upsert `mock` med `enabled=true` (dev-säker katalogpost).
3. Global routing `scope='*'` från `active_provider` (`apple-messages` → `mock`, annars `twilio` om credentials annars `mock`).

`pulse_settings` deprecieras (kvar i DB tills eventuell cleanup-migration).

---

## API (`/api/pulses`)

| Method     | Path                                    | Roll                                                                   |
| ---------- | --------------------------------------- | ---------------------------------------------------------------------- |
| GET        | `/providers/catalog`                    | Katalog + capabilities + field metadata                                |
| GET        | `/providers/settings`                   | Konfigurerade providers                                                |
| PUT/DELETE | `/providers/settings/:providerKey`      | Upsert / delete                                                        |
| POST       | `/providers/settings/:providerKey/test` | Test-SMS (twilio/mock); 400 för verify-only                            |
| GET        | `/providers/routing`                    | Global + dynamic plugin candidates + `enabled`/`providerKey`           |
| PUT        | `/providers/routing`                    | Global default (`providerKey` required)                                |
| PUT/DELETE | `/providers/routing/plugins/:pluginKey` | PUT: `enabled` and/or `providerKey` (nullable); DELETE clears override |
| POST       | `/send`                                 | Resolve via `pluginSource` + router (`sms_enabled` fail-closed)        |

Legacy `GET/POST /settings` och `POST /test` (activeProvider) **ersätts** (ingen parallell shim).

---

## UX-composition (UI/UX)

Provider-lista är startsida (AI Providers-paritet). SMS-loggen är en separat undersida.

| Content view | Innehåll                                                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `list`       | Provider-lista (lägg till / öppna / status) — **default**                                                                       |
| `history`    | SMS-historik (audit-logg)                                                                                                       |
| `routing`    | Stacked cards: **Global standard** + **Per-plugin** (Pulse switch + optional provider; invoice-dense rows; Save alwaysExpanded) |

**Provider detail (list|detail):** Actions header + **Information / Configuration / Test** as stacked `DetailSection` cards (no `?tab=` chips). List + header status use `StatusOutlineBadge` (Tasks pattern). Send test / Test connection scrolls to the Test card.

Navigation: List → History | Routing; History/Routing → tillbaka till List.  
Verify/Stytch: synliga i providers-listan med status **not SMS-routable**; filtreras bort i routing-selects.

Mail + AI Providers use the same stacked routing/view chrome (AI routing has no Clear). See product [`CHANGELOG.md`](../../CHANGELOG.md) §2026-09-23 Mail/Pulse/AI stacked.

---

## Accepterad risk

| ID  | Risk                         | Status                                                                                   |
| --- | ---------------------------- | ---------------------------------------------------------------------------------------- |
| A1  | Klartext secrets i tenant-DB | Security Approved residual — paritet mail/AI/pulses; **väntar TPM medvetet godkännande** |

---

## Icke-mål (v1)

- Twilio Verify / Stytch send- eller OTP-API
- Delad provider-plattform över AI + Pulse
- Prod-deploy utan explicit releasebeslut

Mail multi-provider: se [`P-MAIL_PROVIDER_PLATFORM.md`](P-MAIL_PROVIDER_PLATFORM.md).

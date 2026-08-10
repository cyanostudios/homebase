# ADR — P-PULSE: Pulse Provider Platform (multi-provider + routing)

**Status:** Implementerad lokalt (v1). **QA Approved** + **Security Approved**. Residual **A1** väntar TPM medvetet godkännande. **Ej prod-release.**  
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

| Beslut              | Val                                                                            | Motivering                                                |
| ------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------- |
| Scope               | Pulse-lokal plattform, inte `ai-providers`                                     | SMS/OTP ≠ AI credentials; undvik blandad super-plugin     |
| Lagring             | `pulse_provider_settings` + `pulse_provider_routing`                           | Paritet med AI-tabeller; per `user_id` + key/scope        |
| Secrets             | `secret_primary`, `secret_secondary` + `options` JSONB                         | Katalogdrivna fält; inga Twilio-specifika kolumnnamn      |
| Capabilities        | `smsNotificationCapable` / `verifyCapable`                                     | Separata katalognycklar per tjänst; routing filtrerar SMS |
| Routing precedence  | plugin → global `*` → legacy preferred enabled SMS → fail-closed               | Samma som `AIProviderRouter`                              |
| Routable plugins v1 | `pulses`, `contacts`, `slots`                                                  | Matchar `pluginSource` i BulkMessageDialog                |
| Legacy              | Backfill från `pulse_settings`; runtime läser endast nya tabeller              | Undvik dubbel sanning                                     |
| Hemligheter         | Klartext i tenant-DB; maskerad i API                                           | Accepterad risk A1 (paritet mail/AI/pulses)               |
| Mail                | Separat epic — se [`P-MAIL_PROVIDER_PLATFORM.md`](P-MAIL_PROVIDER_PLATFORM.md) | Explicit TPM-scope                                        |

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

Migration: `server/migrations/124-pulse-provider-platform.sql`

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

| Kolumn                      | Typ                   | Kommentar                       |
| --------------------------- | --------------------- | ------------------------------- |
| `id`                        | SERIAL PK             |                                 |
| `user_id`                   | INT NOT NULL          |                                 |
| `scope`                     | VARCHAR(100) NOT NULL | `*` eller plugin key            |
| `provider_key`              | VARCHAR(50) NOT NULL  | Måste vara SMS-capable vid save |
| `created_at` / `updated_at` | TIMESTAMP             |                                 |
| UNIQUE                      | `(user_id, scope)`    |                                 |

Inget `model`-fält (SMS har inte AI-modeller).

### Legacy backfill

Från `pulse_settings`:

1. Om Twilio-credentials finns → upsert `twilio` settings (`secret_primary`/`secret_secondary`/`options.fromNumber`, `enabled=true`).
2. Alltid upsert `mock` med `enabled=true` (dev-säker katalogpost).
3. Global routing `scope='*'` från `active_provider` (`apple-messages` → `mock`, annars `twilio` om credentials annars `mock`).

`pulse_settings` deprecieras (kvar i DB tills eventuell cleanup-migration).

---

## API (`/api/pulses`)

| Method     | Path                                    | Roll                                        |
| ---------- | --------------------------------------- | ------------------------------------------- |
| GET        | `/providers/catalog`                    | Katalog + capabilities + field metadata     |
| GET        | `/providers/settings`                   | Konfigurerade providers                     |
| PUT/DELETE | `/providers/settings/:providerKey`      | Upsert / delete                             |
| POST       | `/providers/settings/:providerKey/test` | Test-SMS (twilio/mock); 400 för verify-only |
| GET        | `/providers/routing`                    | Global + plugins                            |
| PUT        | `/providers/routing`                    | Global default                              |
| PUT/DELETE | `/providers/routing/plugins/:pluginKey` | Override                                    |
| POST       | `/send`                                 | Resolve via `pluginSource` + router         |

Legacy `GET/POST /settings` och `POST /test` (activeProvider) **ersätts** (ingen parallell shim).

---

## UX-composition (UI/UX)

Provider-lista är startsida (AI Providers-paritet). SMS-loggen är en separat undersida.

| Content view | Innehåll                                                  |
| ------------ | --------------------------------------------------------- |
| `list`       | Provider-lista (lägg till / öppna / status) — **default** |
| `history`    | SMS-historik (audit-logg)                                 |
| `routing`    | Global default + per-plugin override (endast SMS-capable) |

Navigation: List → History | Routing; History/Routing → tillbaka till List.  
Verify/Stytch: synliga i providers-listan med status **not SMS-routable**; filtreras bort i routing-selects.

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

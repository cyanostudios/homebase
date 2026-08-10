# ADR — P-MAIL: Mail Provider Platform (multi-provider + routing)

**Status:** Implementerad lokalt (v1). **QA Approved** + **Security Approved**. Residual **A1** väntar TPM medvetet godkännande. **Ej prod-release.**  
**Epic:** P-MAIL-PROVIDERS  
**Relaterad:** [`P-PULSE_PROVIDER_PLATFORM.md`](P-PULSE_PROVIDER_PLATFORM.md), [`P-AI-SETTINGS_PROVIDER_CONFIGURATION.md`](P-AI-SETTINGS_PROVIDER_CONFIGURATION.md) (mönsterkälla; delade tabeller/API används **inte**)  
**Datum:** 2026-08-10

---

## Sammanfattning

Mail går från en flat `mail_settings`-rad (`provider` + SMTP-/Resend-kolumner) till samma **katalog + credentials-rader + global/per-plugin routing**-modell som Pulse/AI Providers, men **lokalt i pluginet `mail`**.

**v1 send / katalog:** `smtp`, `resend` (båda `emailCapable`).

---

## Beslut

| Beslut              | Val                                                                | Motivering                             |
| ------------------- | ------------------------------------------------------------------ | -------------------------------------- |
| Scope               | Mail-lokal plattform                                               | Email ≠ SMS/AI credentials             |
| Lagring             | `mail_provider_settings` + `mail_provider_routing`                 | Paritet med Pulse/AI                   |
| Secrets             | `secret_primary`, `secret_secondary` + `options` JSONB             | Katalogdrivna fält                     |
| Capabilities        | `emailCapable`                                                     | Routing/test/send filtrerar            |
| Routing precedence  | plugin → global `*` → legacy preferred enabled email → fail-closed | Samma som Pulse                        |
| Routable plugins v1 | `mail`, `contacts`, `slots`, `teams`                               | Matchar `BulkEmailDialog` pluginSource |
| Legacy              | Backfill från `mail_settings`; runtime läser endast nya tabeller   | Undvik dubbel sanning                  |
| Hemligheter         | Klartext i tenant-DB; maskerad i API                               | Accepterad risk A1                     |
| Mock-provider       | Nej                                                                | SMTP täcker lokal/dev                  |

---

## Katalog (v1)

| `provider_key` | Capabilities   | Send adapter  | Secrets / options                                                               |
| -------------- | -------------- | ------------- | ------------------------------------------------------------------------------- |
| `smtp`         | `emailCapable` | SmtpAdapter   | `secret_secondary`=authPass; options: host, port, secure, authUser, fromAddress |
| `resend`       | `emailCapable` | ResendAdapter | `secret_primary`=apiKey; options: fromAddress                                   |

---

## Datamodell

Migration: `server/migrations/125-mail-provider-platform.sql`

### `mail_provider_settings`

Samma generiska kolumner som `pulse_provider_settings` (`provider_key`, `enabled`, `secret_*`, `options`).

### `mail_provider_routing`

Samma som Pulse (`scope` = `*` eller plugin key).

### Legacy backfill

1. Om SMTP host/from finns → upsert `smtp` (auth_pass → secret_secondary; host/port/secure/auth_user/from_address → options).
2. Om Resend API-nyckel finns → upsert `resend`.
3. Global routing `*` från legacy `provider` (`resend` om vald och konfigurerad, annars `smtp` om konfigurerad).

`mail_settings` deprecieras (kvar i DB tills cleanup).

---

## API (`/api/mail`)

| Method     | Path                                    | Roll                                |
| ---------- | --------------------------------------- | ----------------------------------- |
| GET        | `/providers/catalog`                    | Katalog                             |
| GET        | `/providers/settings`                   | Konfigurerade providers             |
| PUT/DELETE | `/providers/settings/:providerKey`      | Upsert / delete                     |
| POST       | `/providers/settings/:providerKey/test` | Test-email                          |
| GET/PUT    | `/providers/routing`                    | Global default                      |
| PUT/DELETE | `/providers/routing/plugins/:pluginKey` | Override                            |
| POST       | `/send`                                 | Resolve via `pluginSource` + router |
| GET        | `/history`                              | Audit-logg                          |
| POST       | `/history/delete`                       | Bulk delete                         |

Legacy `GET/POST /settings` och `POST /test` **ersätts**.

---

## UX-composition

| Content view | Innehåll                     |
| ------------ | ---------------------------- |
| `list`       | Provider-lista — **default** |
| `history`    | Skickad e-post (audit)       |
| `routing`    | Global + per-plugin override |

---

## Accepterad risk

| ID  | Risk                         | Status                                                                             |
| --- | ---------------------------- | ---------------------------------------------------------------------------------- |
| A1  | Klartext secrets i tenant-DB | Security Approved residual — paritet Pulse/AI; **väntar TPM medvetet godkännande** |

---

## Icke-mål (v1)

- Nya email-vendors utöver SMTP/Resend
- Delad provider-plattform över Mail + Pulse + AI
- Prod-deploy utan explicit releasebeslut

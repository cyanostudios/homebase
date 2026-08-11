# ADR — Clubdesk Swish profiles ↔ price lists

**Status:** Accepted. **Grind 1** admin: QA + Security Approved (2026-08-07). Residual **SP-1** awaits TPM. **Etapp 2 (publik cart-QR):** implemented locally on price-list cart (`Att betala`). **Local-first; ej prod-release.**  
**Datum:** 2026-08-07 (etapp 2 cart-QR samma dag)  
**Relaterat:** [`CLUBDESK_PLUGIN_ETAPP1.md`](CLUBDESK_PLUGIN_ETAPP1.md), [`SHARED_QR_CAPABILITY.md`](SHARED_QR_CAPABILITY.md), [`CLUBDESK_PUBLIC_COMPANION.md`](CLUBDESK_PUBLIC_COMPANION.md).

## Sammanfattning

Swish Type C-data lagras som **flera admin-profiler** per tenant, knutna till **en eller fler prislistor**. Belopp sparas aldrig i DB. Info-kortet `swish` är endast UI-skal; `swish.meta` forceras tomt. **Publik cart-QR:** prislistans SSR läser länkad profil (`payee`/`message`) och varukorgen genererar Type C med **aktuellt belopp** + `lockMask = AMOUNT` under **Att betala**.

## Beslut

| Beslut                   | Val                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Lagring                  | `clubdesk_swish_profiles` + junction `clubdesk_swish_profile_price_lists` (migration **123**)                      |
| Fält                     | `payee`, `message` (≤50); **ingen** `amount`-kolumn                                                                |
| Listkoppling             | M:N; **`UNIQUE (price_list_id)`** — max en profil per prislista                                                    |
| Soft max                 | 50 profiler / user                                                                                                 |
| API                      | `/api/clubdesk/swish-profiles` CRUD; CSRF + `requirePlugin('clubdesk')`                                            |
| QR runtime (admin)       | `@/core/qr`; `amount: null`; `lockMask = SWISH_LOCK.AMOUNT` (2)                                                    |
| QR runtime (publik cart) | `public-clubdesk/lib/swishPayload.js` + `qrcode.bundle.js`; amount = cart total; `lockMask = AMOUNT`               |
| QR runtime (publik org)  | `/swish/` SSR + `swish-page-app.js`; primary profile (oldest non-empty payee); `amount: null`; `lockMask = AMOUNT` |
| Migrering                | Singleton `swish.meta` payee/message → första profil; meta nollställs                                              |
| Publik site-content      | Returnerar fortfarande aldrig `swish`-kortet                                                                       |

## Avvisat

- JSON-array i `swish.meta` (saknar FK/unikhet; bryter Clubdesk-tabellmönster).
- Separat `swish`-plugin.

## Säkerhet

**Security Approved (Grind 1 admin).** Residual för TPM:

| ID             | Risk                                                                             | Mitigation                                                                                                   |
| -------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| SP-1           | Flera Swish-nummer/märkningar i tenant-tabeller (betalningsrelaterad admin-data) | Samma auth-gräns som övrig Clubdesk-admin; ownership på profiler och `priceListIds`                          |
| SP-2 (etapp 2) | Publikt `payee`/`message` + belopp i QR på cart                                  | Medvetet: endast för publicerad prislista med länkad profil; amount låst i payload; ingen ny admin-hemlighet |

Etapp 2 cart-QR bör få **ny** Security-granskning före prod.

## Konsekvenser

- Admin Info → Swish: multi-profil UI + tags mot prislistor (`ClubdeskSwishProfilesPanel`).
- Publik `/price-list/:slug` cart: QR under Att betala när profil finns och summa > 0.
- Publik `/swish/`: org-QR + nummer från äldsta profil med payee (Hem-rad); belopp anges i Swish-appen.

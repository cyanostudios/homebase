# Home Dashboard (v1)

Operator- och utvecklardokumentation för den sammansatta startsidan (`/` / `/dashboard`).

**Status:** Implementerat lokalt. **QA Approved.** Security **N/A** (ren klient-UI). **Cups-diagram deferred** (medvetet utanför v1). **Ej prod-release** utan explicit beslut.

## Syfte

Ge användaren en omedelbar överblick: öppna förfrågningar/uppgifter, kommande matcher/träning/slots, och enkla statusdiagram — endast för **aktiverade** plugins.

## Kodplatser (verifierade)

| Del             | Sökväg                                                               |
| --------------- | -------------------------------------------------------------------- |
| Shell           | `client/src/core/ui/Dashboard.tsx`                                   |
| Sektioner       | `client/src/core/ui/dashboard/*`                                     |
| Routing         | `client/src/core/routing/routeMap.ts` → `/`, `/dashboard`            |
| Mount           | `currentPage === 'dashboard'` i app-content                          |
| i18n            | `client/src/i18n/locales/sv.json` / `en.json` → nyckel `dashboard.*` |
| Enabled plugins | `client/src/hooks/useEnabledPlugins.ts`                              |

**Ingen** dedikerad `/api/dashboard`-endpoint. Data kommer från befintliga plugin-hooks (`useTasks`, `useRequests`, `useTeams`, `useMatches`, `useSchedulePlans`, `useInvoices`, `useSlotsContext`).

## Layout (v1)

1. **KPI-rad** — öppna requests, aktiva tasks, kommande matches, lag totalt (villkorligt per plugin).
2. **Huvudkolumn (2/3)** — snabbåtgärder + kommande aktivitet (matcher / lag med träning).
3. **Sidokolumn (1/3)** — bokningsbara slots + kompakt lista lag med träning.
4. **Diagram-rad** — SVG donut (tasks, teams), stacked bar (invoices).

Tom-vy: om ingen sektion kan visas → `dashboard.noWidgets`.

## Plugin → sektion

| Plugin     | KPI                 | Snabbåtgärd | Aktivitet / sidebar                      | Diagram      |
| ---------- | ------------------- | ----------- | ---------------------------------------- | ------------ |
| `requests` | Öppna               | Ja          | —                                        | —            |
| `tasks`    | Aktiva              | Ja          | —                                        | Donut status |
| `matches`  | Kommande            | Ja          | Lista kommande (max 5)                   | —            |
| `teams`    | Totalt + aktiv/paus | —           | Med `schedule`: lag med `training_times` | Donut status |
| `schedule` | —                   | Ja          | Kräver även `teams` för träningslistor   | —            |
| `slots`    | —                   | Ja          | Upcoming `slot_time` (max 5)             | —            |
| `invoices` | —                   | —           | —                                        | Stacked bar  |

Snabbåtgärder navigerar via `onPageChange` till plugin-sidan (öppnar **inte** create-panel i v1).

## Medvetna begränsningar (v1)

- **Ingen** drag-and-drop / användarordnad layout.
- **Ingen** cups-visualisering på home dashboard (deferred; Cups har egen Statistik-vy).
- Hooks anropas **alltid** i `Dashboard.tsx` (stabil hook-ordning); UI döljs per `useEnabledPlugins`.
- Datumformat i utils använder `Intl` med locale `sv-SE` (inte aktiv i18n-språkinställning).
- Per-plugin `dashboardWidget` i `PLUGIN_REGISTRY` / `*DashboardWidget.tsx` finns kvar i registret men **används inte** av den nya `Dashboard.tsx`-shellen.

## Relaterat

- UI-token för äldre widget-kort: `DASHBOARD_WIDGET_*` i `detailViewCardStyles.ts` (legacy cards).
- Cups Statistik (plugin-intern): ADR `docs/ai/adr/CUPAPPEN_FIRST_PARTY_PAGEVIEWS.md` — separat från home dashboard.

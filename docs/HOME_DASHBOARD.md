# Home Dashboard (v1)

Operator- och utvecklardokumentation för den sammansatta startsidan (`/` / `/dashboard`).

**Status:** Implementerat lokalt. **QA Approved.** **Security Approved** (ren klient-UI; försumbar attackyta). **Docs Updated.** **Cups-diagram deferred.** **Ej prod-release** utan explicit beslut.

## Syfte

Ge användaren en omedelbar överblick: öppna förfrågningar/uppgifter, dagens träningsschema, kommande matcher, slots och enkla statusdiagram — endast för **aktiverade** plugins.

## Kodplatser (verifierade)

| Del             | Sökväg                                                               |
| --------------- | -------------------------------------------------------------------- |
| Shell           | `client/src/core/ui/Dashboard.tsx`                                   |
| Sektioner       | `client/src/core/ui/dashboard/*`                                     |
| Utils / limit   | `dashboardUtils.ts` (`DASHBOARD_LIST_WIDGET_LIMIT`, `selectActive*`) |
| Mount           | `client/src/core/app/AppContent.tsx` (`currentPage === 'dashboard'`) |
| Routing         | `client/src/core/routing/routeMap.ts` → `/`, `/dashboard`            |
| i18n            | `client/src/i18n/locales/sv.json` / `en.json` → `dashboard.*`        |
| Enabled plugins | `client/src/hooks/useEnabledPlugins.ts`                              |

**Ingen** dedikerad `/api/dashboard`-endpoint. Data kommer från befintliga plugin-hooks (`useTasks`, `useRequests`, `useTeams`, `useMatches`, `useSchedulePlans`, `useInvoices`, `useSlotsContext`).

### Widget-filer (verifierade)

| Widget                  | Fil                           |
| ----------------------- | ----------------------------- |
| Today’s schedule        | `DashboardTodaySchedule.tsx`  |
| Upcoming activity       | `DashboardActivityPanel.tsx`  |
| Open requests           | `DashboardRequestsWidget.tsx` |
| Active tasks            | `DashboardTasksWidget.tsx`    |
| Sidebar (slots/träning) | `DashboardSidebar.tsx`        |

## Layout (verifierad mot `Dashboard.tsx`)

1. **KPI-rad** — öppna requests, aktiva tasks, kommande matches, lag totalt (villkorligt per plugin).
2. **Huvudkolumn (2/3)** — snabbåtgärder + öppna requests-lista + aktiva tasks-lista.
3. **Sidokolumn (1/3)** — dagens schema + kommande matcher (upcoming activity) + bokningsbara slots / lag med träning.
4. **Diagram-rad** — SVG donut (tasks, teams), stacked bar (invoices).

Tom-vy: om ingen sektion kan visas → `dashboard.noWidgets`.

Today’s schedule och Upcoming activity ligger i samma sidokolumn ovanför Bookable slots; de delar inte samma höjd (`items-start`). På `sm`–`lg` kan Today/Upcoming ligga i två kolumner; på `lg+` staplas de i sidokolumnen.

## Plugin → sektion

| Plugin     | KPI                 | Snabbåtgärd | Huvudkolumn-widget                     | Sidokolumn                                        | Diagram      |
| ---------- | ------------------- | ----------- | -------------------------------------- | ------------------------------------------------- | ------------ |
| `requests` | Öppna               | Ja          | Aktiva (ej completed/cancelled), max 5 | —                                                 | —            |
| `tasks`    | Aktiva              | Ja          | Aktiva (ej completed/cancelled), max 5 | —                                                 | Donut status |
| `matches`  | Kommande            | Ja          | —                                      | Upcoming activity (max 5) + lagbadge              | —            |
| `teams`    | Totalt + aktiv/paus | —           | —                                      | Med `schedule`: Today’s schedule; sidebar-träning | Donut status |
| `schedule` | —                   | Ja          | —                                      | Kräver `teams` för Today’s schedule / träning     | —            |
| `slots`    | —                   | Ja          | —                                      | Upcoming `slot_time` (max 5)                      | —            |
| `invoices` | —                   | —           | —                                      | —                                                 | Stacked bar  |

Snabbåtgärder navigerar via `onPageChange` till plugin-sidan (öppnar **inte** create-panel i v1).

### Widget-beteende (verifierat)

- **Today’s schedule** — dagens `training_times` via `buildTeamSlots`, visuellt som schedule-slots (färger, MapPin), read-only.
- **Upcoming activity** — endast kommande matcher; lagbadge via `formatTeamLabel` + `SERIES_TEAM_BADGE_STYLES`.
- **Open requests / Active tasks** — `selectActiveRequestsForDashboard` / `selectActiveTasksForDashboard` i `dashboardUtils.ts` (filter + sort + `DASHBOARD_LIST_WIDGET_LIMIT`).

## Relaterade listbeteenden (utanför dashboard-shell)

- **Matches list:** default sort `start_time` asc (`isMatchAscDefaultField`) — närmaste match först; samma default när fältet väljs i dropdown/tabell.
- **Teams / Matches list + Quick Context:** `ListToolbar` ligger ovanför panel-splitten (full bredd); se `PLUGIN_VIEW_IMPLEMENTATION_GUIDE.md` § Quick Context wiring.

## Medvetna begränsningar (v1)

- **Ingen** drag-and-drop / användarordnad layout.
- **Ingen** cups-visualisering på home dashboard (deferred; Cups har egen Statistik-vy).
- Hooks anropas **alltid** i `Dashboard.tsx` (stabil hook-ordning); UI döljs per `useEnabledPlugins`.
- Datumformat i utils använder `Intl` med locale `sv-SE` (inte aktiv i18n-språkinställning).
- Per-plugin `dashboardWidget` i `PLUGIN_REGISTRY` / `*DashboardWidget.tsx` finns kvar i registret men **används inte** av den nya `Dashboard.tsx`-shellen.
- List widgets är inte klickbara navigation i v1 (endast översikt).
- Upcoming activity visar ingen separat empty-copy när det saknas kommande matcher (tom lista under rubriken).

## Relaterat

- UI-token för äldre widget-kort: `DASHBOARD_WIDGET_*` i `detailViewCardStyles.ts` (legacy cards).
- Cups Statistik (plugin-intern): ADR `docs/ai/adr/CUPAPPEN_FIRST_PARTY_PAGEVIEWS.md` — separat från home dashboard.
- Changelog: `docs/CHANGELOG.md` (2026-08-25 Home dashboard widgets + list layout).

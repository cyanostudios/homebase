# ADR — Platform Preferences `timeFormat` (12h / 24h)

**Status:** Implemented locally. **QA Approved**. Security grind **N/A** (user preference enum in existing `user_settings` JSONB; no new API surface). **Ej prod-release** utan explicit beslut.  
**Datum:** 2026-08-10  
**Scope:** Wall-clock display format for Homebase UI and plugins. Single source of truth in Preferences.

**Relaterat:** Canonical formatters [`client/src/core/utils/dateFormat.ts`](../../client/src/core/utils/dateFormat.ts); preference store [`client/src/core/settings/timeFormatPreference.ts`](../../client/src/core/settings/timeFormatPreference.ts); plugin convention [`templates/README.md`](../../templates/README.md).

---

## Sammanfattning

Match- och övrig tidvisning ska följa **användarens** 12h/24h-val i **Settings → Preferences**, inte UI-språk (`i18n`) och inte klock-widgetens lokala lagring. Plugins ska formatera wall-clock via `@/core/utils/dateFormat` (eller helpers som delegerar dit, t.ex. `formatMatchDateTime`).

---

## Beslut

| Beslut                     | Val                                                                                      | Motivering                                                         |
| -------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Sanning                    | `preferences.timeFormat`: `'12h' \| '24h'` (default `'24h'`)                             | Persistens i befintlig `user_settings` JSONB; synkas per användare |
| Canonical API              | `formatDate` / `formatDateTime` / `formatDateTimeShort` / `formatTime` i `dateFormat.ts` | En plats sätter `hour12` från preference-store                     |
| Match-tider                | `formatMatchDateTime`: locale för weekday/month; `hour12` från preferens                 | Fixar Teams/Matches AM/PM när UI-språk är `en`                     |
| Clock-widget               | Läser plattformspreferensen; äger **inte** `timeFormat`                                  | Undviker dual writer (tidigare `homebase-clock-settings`)          |
| Migrering                  | Om Preferences saknar värde: kopiera ev. legacy clock-`localStorage`, annars `24h`       | Engångs bakåtkompatibilitet                                        |
| Datumlocale i `dateFormat` | Fortfarande hårdkodad `sv-SE` för datumdel                                               | Endast **tidscykel** är preferensstyrd i denna epic                |
| Timezone-unifiering        | Preferences `timezone` vs clock `timezone` oförändrad                                    | Utanför scope                                                      |

---

## Konsumtionskontrakt (plugins)

```ts
import {
  formatDate,
  formatDateTime,
  formatDateTimeShort,
  formatTime,
} from '@/core/utils/dateFormat';
import { useTimeFormat } from '@/core/settings/useTimeFormat';

// React surfaces that format during render should subscribe so UI updates on save:
useTimeFormat();

formatDateTime(item.updatedAt);
formatTime(slot.start);
```

**Förbjudet för wall-clock:** rå `toLocaleString` / `toLocaleTimeString` utan `hour12` från preferensen; styra AM/PM via `i18n.language`.

**Lagring av schema-tider** (t.ex. Schedule/Training som `HH:mm`-strängar) är **inte** automatiskt omformaterade — endast Date-baserad visning via helpers ovan.

---

## Accepterade residualer (QA)

| Residual                                           | Notering                                                                   |
| -------------------------------------------------- | -------------------------------------------------------------------------- |
| `ActivityLogForm` lokal `toLocaleString('sv-SE')`  | Följer ännu inte preferensen                                               |
| `exportUtils` `_formatDateTime`                    | Hårdkodad `sv-SE` utan preferens-`hour12`                                  |
| Preference-store nollställs inte vid logout        | Delad webbläsare kan behålla föregående users format tills nästa hydrering |
| Race: Preferences-formulär vs migreringspersistens | Edge case vid första inloggning efter uppgradering                         |

---

## Konsekvenser

- Nya plugins: följ `templates/README.md` Dates/times-raden.
- Clock UI: 12h/24h ändras endast under Settings → Preferences.
- Ingen DB-migration; fältet är JSONB-merge på category `preferences`.

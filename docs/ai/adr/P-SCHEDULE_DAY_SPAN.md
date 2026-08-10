# ADR — Schedule day span viewport (1 / 3 / 7 / stacked)

**Status:** Implemented locally. **QA Approved** (inkl. bläddring + stacked). Security **N/A** (client UI / `sessionStorage` only; no new API). **Ej prod-release** utan explicit beslut.  
**Datum:** 2026-08-10  
**Scope:** Client-only calendar viewport modes for schedule desktop.

**Relaterat:** Helpers [`client/src/plugins/schedule/utils/scheduleDaySpan.ts`](../../../client/src/plugins/schedule/utils/scheduleDaySpan.ts); produkt-changelog [`docs/CHANGELOG.md`](../../CHANGELOG.md) (post 2026-08-10 dagspann).

---

## Sammanfattning

Schedule på desktop kan växla mellan tidgrid med **1**, **3** eller **7** veckodagar, eller **stacked** (samma staplade listvy som mobil). Modes är en **viewport** över samma veckodagsdata — inte ett nytt schema, API eller kapacitetsfilter.

---

## Beslut

| Beslut     | Val                                                                           | Motivering                            |
| ---------- | ----------------------------------------------------------------------------- | ------------------------------------- |
| Kontrakt   | Grid: `ScheduleTimeGrid.visibleDays`; stacked: `ScheduleWeekView`             | Återanvänd mobil-listan för stacked   |
| Daglogik   | `resolveVisibleWeekDays` — 1/3 från ankare (klampat), 7/stacked = hela veckan | Matchar UX; ingen wrap                |
| Persistens | `sessionStorage` `schedule:daySpan` (`1`/`3`/`7`/`stacked`)                   | Samma mönster som list `listViewMode` |
| State      | `useScheduleDaySpan` i `ScheduleList`, props till `PlanView`                  | Ett val överlever schema-byte         |
| Footer     | Oförändrad (hela veckans kapacitet)                                           | Viewport ≠ kapacitetsfilter           |
| Mobil      | Toggle dold; alltid `ScheduleWeekView`                                        | Oförändrad mobil-UX                   |
| Bläddring  | Chevron endast för **1** och **3**; steg = span; ingen wrap                   | Användarkrav                          |
| Ankare     | Återställs till idag vid vy-byte; ej session-sparat                           | Enkel v1                              |
| Stacked    | Full vecka; ingen 1/3-filtrering eller bläddring                              | Explicit krav                         |

---

## Icke-mål

- Prev/next i **7** eller **stacked**
- Wrap till annan kalendervecka
- Drag/drop i stacked (mobilparitet)
- Backend / migrations
- Filtrering av footer eller dialogers daglista

---

## Accepterade begränsningar

- 3-dagarsläge nära söndag kan visa färre än tre kolumner (label förblir `3`).
- “Idag” beror på klientens lokala timezone; ankare nollställs vid vy-byte, inte automatiskt över midnatt.
- Bläddringssteg för 3 är tre veckodagar (t.ex. mån→tors), inte glidande ett-dag-steg.
- Stacked är listöversikt (klick öppnar detalj); ingen drag/drop som i tidgrid.

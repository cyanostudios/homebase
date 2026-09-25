# SportAdmin public discovery — Sorgenfri FF

**Date:** 2026-09-24  
**Scope:** Public HTTP GET only (`User-Agent: HomebaseSportAdminDiscovery/0.1`). No login, no private areas.  
**Primary URL:** `https://sorgenfriff.web.sportadmin.se/start/?ID=471967`  
**Base:** `https://sorgenfriff.web.sportadmin.se/`  
**Charset observed:** `iso-8859-1`  
**Lang:** `sv-SE`

This report is the hard gate before any SportAdmin parser or schema work. Counts of teams/news/matches in product briefs are illustrations, not measured inventory here.

---

## Path probe (club host)

| Path                                                                                              | Result                                            |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `/start/`, `/nyheter/`, `/match/`, `/kalender/`, `/dokument/`, `/sida/`, `/sektion/`, `/galleri/` | Real SportAdmin HTML (200)                        |
| `/team/`, `/teams/`, `/lag/`, `/news/`, `/matcher/`, `/calendar/`                                 | Generic 404 HTML body — **not** used by this club |

---

## START PAGE

**URL:** `https://sorgenfriff.web.sportadmin.se/start/?ID=471967`  
**Also:** `…/start/Default.asp?ID=471967&v=4`  
**HTTP:** 200, ~60 KB

### HTML structure

- Dual `<title>` (short club name + SEO title).
- Bootstrap 2.x chrome: `navbar`, `topMenu`, `menyLista`, `lagmeny`, `tMenuTop`, `tMenuObj`, `tMenuSektion`, `dropdown-menu`.
- Content regions: `sektionsRutaOuter` / `sektionsruta`, `mediumDiv`, carousel, nested `table`/`div` (few semantic headings in main chrome).
- Scripts: jQuery, `sa.js`, `artikel.js`, Bootstrap, Klaro, gtag.

### Links (main nav)

| Label                | Pattern                              |
| -------------------- | ------------------------------------ |
| Hem                  | `/start/?ID=471967` or `/?SID=54710` |
| Nyheter              | `/nyheter/?ID=471968`                |
| Om Sorgenfri FF      | `/sida/?ID=471972`                   |
| Våra lag och tränare | `/sektion/?ID=471974`                |
| Avgifter 2026        | `/sida/?ID=480418`                   |
| Kalender             | `/kalender/?ID=471969`               |
| Matcher              | `/match/?ID=471975`                  |
| Dokument             | `/dokument/?ID=471971`               |
| Bilder               | `/galleri/?ID=503634`                |

### Team bar (`lagmeny`)

Teams are **not** under `/team/` or `/lag/`. Links use site id:

```text
/?SID={teamSiteId}
```

Examples (home club):

| Label                           | SID                                      |
| ------------------------------- | ---------------------------------------- |
| Hem                             | 54710                                    |
| Fotbollsskola Flickor           | 54748                                    |
| Fotbollsskola (P2021)           | 54749                                    |
| Fotbollsskola (P2019)           | 66233                                    |
| Fotbollsskola (P2020)           | 66234                                    |
| F16 / F12 / F10 / F9 / F8       | 54746, 54766, 54747, 60176, 67794        |
| P16 / P12 / P11 / P10 / P9 / P8 | 54740, 54750, 54751, 54741, 60175, 66232 |

Category labels in nav (`Fotbollsskola`, `Flicklag`, `Pojklag`) are structural for discovery/grouping.

### Images

- Logo: `/im/getLogga.asp?SID=54710&v=23` (`#foreningslogotyp`)
- Local: `/spalt/1919/54710/…`, `/images/1919/54710/…`
- CDN: `https://cdn.sportadmin.se/2563/h/1919/{hash}_{L|M}.{jpg|png}`
- Occasional Facebook CDN assets for social widgets

### External resources / widgets (inline)

```text
ajax('#nextGame', '../match/wNextGame.asp?SID=54710');
ajax('#newsWidget1', '../widget/getOrgNews.asp?URL=…');  // external RSS, not club news
```

`wNextGame.asp?SID=54710` observed as **200 with empty body** at discovery time — do not depend on it for MVP.

### News teasers on start

Example: `/nyheter/?ID=471968&NID=1354232` with title + datetime in link text (`YYYY-MM-DD HH:MM`).

### Metadata

- Canonical often points at branded host: `https://www.sorgenfriff.se/start/?ID=471967`
- `og:type=website`

### Login / member surfaces (outbound only — not fetched)

| Surface      | Host                                   |
| ------------ | -------------------------------------- |
| Logga in     | `identity.sportadmin.se`               |
| Mina sidor   | `portalweb.sportadmin.se/mypages/…`    |
| Ledare/admin | `entry.sportadmin.se/groupsOverview?…` |
| Booking      | `sportadmin.se/book/?F=…`              |

UI markers: `logInBtn`, `logInDiv`, `iframe name=loginFrame`.

---

## TEAM PAGE

**Representative:** `https://sorgenfriff.web.sportadmin.se/?SID=54748`  
**Resolves to:** `/start/?ID=472283` (“Fotbollsskola Flickor”)

**Teams overview:** `/sektion/?ID=471974` — lists same `SID=` targets.

### URL pattern

```text
/?SID={teamSiteId}
→ /start/?ID={teamPageId}
```

Each team has **scoped page IDs** for submodules (nyheter, kalender, matcher, truppen/grupp, kontakt/sida), discovered from that team’s shell — not hard-coded from home IDs. **Bildgalleri is intentionally not synced.**

### Team metadata (public)

- Name in title / nav label (e.g. `F8 (F2018)`, `P12 (2014)`).
- Category/age often parsable from label text and parent menu group (`Flicklag` / `Pojklag` / year in parentheses).
- Welcome / description copy on team start page when present.
- Images: same CDN/logo patterns; logo helper may still reference home `SID`.
- Truppen: public player/leader names (+ age labels when shown).
- Kontakt: public contact page body (often email).

### Nested public modules on team pages

| Label       | Path pattern     | Synced into                                                     |
| ----------- | ---------------- | --------------------------------------------------------------- |
| Nyheter     | `/nyheter/?ID=`  | Team news teasers + club news list                              |
| Kalender    | `/kalender/?ID=` | Club events (AJAX) when discovered                              |
| Matcher     | `/match/?ID=`    | Match snippets on team start; club match details from club list |
| Truppen     | `/grupp/?ID=`    | Team `players` + `leaders`                                      |
| Kontakt     | `/sida/?ID=`     | Team `contact` (plain text)                                     |
| Bildgalleri | `/galleri/?ID=`  | **Skipped**                                                     |

Labels observed: “Kommande matcher”, “Spelade matcher”, team news/calendar/match section links with team-scoped `ID=`.

---

## NEWS PAGE

### List

**URL:** `https://sorgenfriff.web.sportadmin.se/nyheter/?ID=471968`

### Detail

**URL:** `https://sorgenfriff.web.sportadmin.se/nyheter/?ID=471968&NID=1354232`  
**Also:** `…/nyheter/Default.asp?ID=471968&NID=1354232&ver=1`

### Stable DOM patterns

- Archive rows: `div.news` → `table` → `a[href=?ID={pageId}&NID={newsId}]` + date `span`
- **Date format:** `YYYY-MM-DD` or `YYYY-MM-DD HH:MM`
- `og:type=article`, `og:title`, `og:image` (CDN)
- Script: `artikel.js`

### Source URL pattern

```text
/nyheter/?ID={newsSectionId}&NID={articleId}
```

Home news section ID: **471968**. Example NID: **1354232**.

No public club JSON news API found. External RSS via `getOrgNews.asp` is third-party content, out of club-news import scope unless explicitly configured later.

---

## MATCH PAGE

### List

**URL:** `https://sorgenfriff.web.sportadmin.se/match/?ID=471975` (~111 KB)

### Structure

- Heavy `table` layout.
- Rows link to **calendar activity** detail (`AID=`), not a `/match/?MID=` page.
- Team filter: `?ID={teamMatchPageId}&GID=0`
- Club crests: `https://cdn.sportadmin.se/0/clubmark/{id}_15_S.webp` (detail may use `_L.webp`)
- CSS hooks on detail: `matchRuta`, `matchVal33`, `matchVal50`, venue via `class=mCal`

### Detail (shared with calendar)

**Example:** `https://sorgenfriff.web.sportadmin.se/kalender/?ID=471975&AID=31236703`

Observed fields: home/away team names, time, venue text, competition link (e.g. svenskfotboll.se).

### URL patterns

```text
List:   /match/?ID={matchSectionId}
Filter: /match/?ID={teamPageId}&GID=0
Detail: /kalender/?ID={pageId}&AID={activityId}
```

Example AID: **31236703**. Home match section ID: **471975**.

---

## CALENDAR

**URL:** `https://sorgenfriff.web.sportadmin.se/kalender/?ID=471969`

### HTML / AJAX

- Shell loads calendar via JS: `calHref('ajaxKalender.asp?ID=471969')`
- Fragment: `https://sorgenfriff.web.sportadmin.se/kalender/ajaxKalender.asp?ID=471969` — **HTML partial** (~172 KB), not JSON
- Many unique `AID=` event links: `?ID={pageId}&AID={activityId}`
- Subscribe UI present (`#prenumreraText`, `#btn-copy`)

### iCal / webcal

| Finding                  | Detail                                                                           |
| ------------------------ | -------------------------------------------------------------------------------- |
| Embedded subscribe URL   | `https://portalweb.sportadmin.se/webcal?id=232cafeb-eb06-4751-b861-20987895b63d` |
| iOS variant              | `webcal://portalweb.sportadmin.se/webcal?id=…`                                   |
| Live HEAD on that URL    | **HTTP 410** (`text/calendar`) at discovery time                                 |
| Club-host `.ics` guesses | Not usable public feeds found                                                    |

**MVP implication:** Prefer HTML + `ajaxKalender.asp` for events. Treat iCal as optional Priority 3: attempt if URL discovered and HTTP success; **410 / missing = warning, not fatal**.

Event detail = same `/kalender/?ID=…&AID=…` as matches.

---

## Documents / links / images (public)

| Surface       | URL pattern                                                                 |
| ------------- | --------------------------------------------------------------------------- |
| Dokument      | `/dokument/?ID=471971`                                                      |
| Galleri       | `/galleri/?ID=503634`                                                       |
| Static pages  | `/sida/?ID=…`                                                               |
| External CTAs | Stadium shop, Instagram, Facebook, Google Forms, entry.sportadmin.se signup |

Importer should capture **public outbound hrefs** as links; must not follow login/portal hosts for content sync.

---

## Query / ID conventions (do not hard-code club values)

| Param | Meaning                                               |
| ----- | ----------------------------------------------------- |
| `ID`  | SportAdmin page / section resource id                 |
| `SID` | Team/site id (resolves to a start `ID`)               |
| `NID` | News article id                                       |
| `AID` | Calendar / match activity id                          |
| `GID` | Match list filter (observed `0` on team filter links) |

Normalized Homebase ids should use external ids discovered at runtime, e.g. `sportadmin:news:{NID}`, `sportadmin:team:{SID}`, `sportadmin:event:{AID}`.

---

## Home club ID cheat sheet (Sorgenfri FF — fixtures only)

| Resource      | ID     |
| ------------- | ------ |
| Start         | 471967 |
| Nyheter       | 471968 |
| Kalender      | 471969 |
| Dokument      | 471971 |
| Om-sida       | 471972 |
| Sektion (lag) | 471974 |
| Matcher       | 471975 |
| Galleri       | 503634 |
| Home SID      | 54710  |

These IDs belong in **test fixtures**, never as production defaults.

---

## Access strategy confirmation

| Priority        | Finding                                                                                      |
| --------------- | -------------------------------------------------------------------------------------------- |
| 1 — Public HTML | Primary source for start, teams (`SID`), news (`NID`), match list, event detail              |
| 2 — Public XHR  | `ajaxKalender.asp` returns HTML; `wNextGame.asp` unreliable; no authenticated JSON API found |
| 3 — iCal/webcal | URL may be embedded; live feed returned **410** — optional / warning                         |
| Forbidden       | identity / portal / entry login flows not used                                               |

---

## Fixture guidance (for Backend)

Capture offline HTML (and calendar AJAX fragment) for at least:

1. Start `ID=471967`
2. One team via `SID=` → start page
3. News list + one `NID=` detail
4. Match list + one `AID=` detail
5. Kalender shell + `ajaxKalender.asp` fragment

Tests must not require SportAdmin online.

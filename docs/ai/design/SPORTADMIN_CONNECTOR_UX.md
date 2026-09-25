# Design package — SportAdmin Connector (Grind 3)

**Status:** Ready for Frontend (Grind 3)  
**Date:** 2026-09-24  
**Sources:** TPM Grind 1 (isolated storage) + Solution Architect ADR [`SPORTADMIN_CONNECTOR_BETA_MVP.md`](../adr/SPORTADMIN_CONNECTOR_BETA_MVP.md) + discovery [`SPORTADMIN_SORGENFRI_FF.md`](../discovery/SPORTADMIN_SORGENFRI_FF.md)

**Not in scope for this design:** public club website, SEO routes, interval picker UI, binary image cache, write to teams/matches/schedule, Contacts-class CRUD mail-layout.

---

## 1. Användarflöde

### Primär användare

Föreningsadministratör som redan publicerar i SportAdmin och vill att Homebase ska visa samma **publika** information utan att skriva om den.

### Flöde A — Koppla SportAdmin (första gången)

1. Öppna pluginet **SportAdmin** från sidomenyn.
2. Landar på **Integration** (standardvy).
3. Anger SportAdmin site URL (t.ex. `https://sorgenfriff.web.sportadmin.se/`).
4. Sparar → systemet kör **connection test** automatiskt.
5. Ser resultat per sektion: ✓ träff eller ⚠ saknas (kalender/iCal får vara ⚠ utan att blockera).
6. Om URL otillgänglig eller inte SportAdmin-lik → **fel**, ingen lyckad koppling; tidigare cache (om någon) behålls synlig.
7. Vid lyckad bas + minst partiell discovery → status **Connected** (eller **Partial** om varningar).

### Flöde B — Synka och övervaka

1. Ser statusrad: Connected / Partial / Error / Not configured.
2. Ser **Last sync**, **Next sync**, importerade antal (Teams, News, Matches, Events, Links).
3. Trycker **Sync now** → kort busy-state på knappen; ingen blockerande modal obligatorisk i MVP (valfritt progress om sync > ~2 s).
4. Vid sync-fel: status Error eller Partial; banner **using cached data from &lt;timestamp&gt;**; senaste lyckade data finns kvar i Teams.
5. **View errors** öppnar felvy (lista utan personuppgifter).

### Flöde C — Discovery / debug (beta)

1. Växlar till kategori **Debug**.
2. Ser träd: Start → discovered links → resource counts → parser/errors.
3. Används för att förstå varför en sektion är ⚠ — inte för att redigera data.

### Flöde D — Teams (ersätter Demo)

1. Växlar till kategori **Teams** (ersätter **Demo**).
2. Ser eventuell stale banner, sedan mail-layout **lista | detalj** inuti Teams-panen (~20/80 desktop).
3. Väljer ett lag → detail visar Identitet, Beskrivning (om finns), Källa (`source_url` externt).
4. Ingen create/edit/delete; inga Demo-widgets (nyheter/matcher/filter).
5. Phone: lista först; rad → detail med tillbaka till lista.

### Flöde E — Stale / SportAdmin nere

1. Användaren öppnar Teams eller Integration efter misslyckad sync.
2. Tydlig, lugn banner (warning, inte alarmröd sida-tom): SportAdmin unavailable / sync failed + **using cached data from …**
3. Teams fortsätter visa senaste lyckade cache. Aldrig tom “hela sajten nere”-upplevelse enbart för att SportAdmin felade.

---

## 2. Gränssnittsunderlag

### Informationsarkitektur

| Yta             | Syfte                                                        |
| --------------- | ------------------------------------------------------------ |
| **Integration** | URL, connection test, status, counts, Sync now, errors entry |
| **Teams**       | Read-only list + detail over cached SID teams                |
| **Debug**       | Discovery tree for beta                                      |

**Shell:** `PluginSettingsPageShell` med tre kategorier — Teams bäddar in list|detail; hela pluginet är inte Contacts CRUD.

Föreslagna category keys (ikoner från `SETTINGS_CATEGORY_ICONS` eller närmaste Lucide-mappning):

| Key           | Label (SV)  | Icon hint         |
| ------------- | ----------- | ----------------- |
| `integration` | Integration | Settings2 / Link2 |
| `teams`       | Lag         | Users             |
| `debug`       | Debug       | Bug / Network     |

Header: **Close**; **Save** endast när URL-fältet är dirty (`SettingsHeaderSaveButton`). Sync now är **body-action**, inte header-Save.

---

### 2.1 Integration — wireframe (text)

```text
┌─ SportAdmin ──────────────────────────────── Close │ Save (om dirty) ─┐
│  [ Integration ]  [ Teams ]  [ Debug ]                                  │
├─────────────────────────────────────────────────────────────────────────┤
│  DetailSection: Anslutning                                               │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ SportAdmin URL                                                    │  │
│  │ [ https://….web.sportadmin.se/                              ]     │  │
│  │ Hjälp: Publik webbplats-URL. Ingen inloggning krävs.              │  │
│  │                                                                   │  │
│  │ Status:  ● Connected | Partial | Error | Not configured           │  │
│  │          (StatusOutlineBadge — outline, ingen filled pill)        │  │
│  │                                                                   │  │
│  │ Last sync:  14 sep 2026 15:30                                     │  │
│  │ Next sync:  14 sep 2026 16:00                                     │  │
│  │                                                                   │  │
│  │ [⚠ banner om last sync failed + cached from …]                    │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  DetailSection: Connection test                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ ✓ SportAdmin detected                                             │  │
│  │ ✓ Organization found                                              │  │
│  │ ✓ 13 teams found                                                  │  │
│  │ ✓ 42 news items found                                             │  │
│  │ ✓ 87 matches found                                                │  │
│  │ ⚠ Calendar feed not available (HTML calendar OK / or not found)   │  │
│  │ (Antal = faktiska API-värden; exemplen ovan är bara format)        │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  DetailSection: Importerat                                               │
│  ┌──── ListFilterStatCard row (icke-klickbar KPI i MVP) ─────────────┐ │
│  │  Teams 13   News 42   Matches 87   Events 126   Links n           │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  [ Sync now ]  RoundIconLabelButton secondary CloudDownload              │
│  [ View errors ]  RoundIconLabelButton secondary / text link             │
└──────────────────────────────────────────────────────────────────────────┘
```

**Status semantics (badge):**

| State          | When                                                                    | Badge           |
| -------------- | ----------------------------------------------------------------------- | --------------- |
| Not configured | Ingen sparad URL                                                        | muted           |
| Connected      | URL OK + sync OK, inga blockerande fel                                  | success         |
| Partial        | Connected bas men ⚠ i test eller senaste sync hade partiella resursfel | warning         |
| Error          | URL unreachable / not SportAdmin / senaste sync failed helt             | danger          |
| Syncing        | Under manuell sync                                                      | info (optional) |

**Connection test rows:**

- ✓ = success text color (`QC_STATUS` success language)
- ⚠ = warning — integration remains usable
- ✕ = only for fatal checks (URL unreachable, not SportAdmin) — blockerar “Connected”

**View errors:**

- Inline expand under Integration **or** same-page panel below buttons (prefer same category, no separate route in MVP).
- List: timestamp, resource path/URL (public), HTTP status, message.
- Empty: `DETAIL_EMPTY_STATE_CLASS` “Inga fel loggade.”
- Never show personal data fields.

**Save behaviour:**

- Dirty URL → Save enabled.
- On Save: persist + run connection test; show results in Connection test section.
- Invalid/unreachable: Error status + inline destructive message; do not clear existing cached counts/Teams data.

**Sync now:**

- Disabled when Not configured or Syncing.
- Success: refresh timestamps + counts; brief emerald inline “Synkronisering klar”.
- Failure: banner + errors list; keep counts from last success.

---

### 2.2 Teams — wireframe (text)

```text
┌─ Teams ─────────────────────────────────────────────────────────────┐
│  (optional stale banner — same as Integration)                        │
│                                                                       │
│  ┌─ list (~20%) ─────────┐  ┌─ detail (~80%) ──────────────────────┐ │
│  │ Team name             │  │ Card: Identitet                      │ │
│  │  category · age_group │  │  [optional image]  Name              │ │
│  │ ───────────────────── │  │  category · age_group                │ │
│  │ (active row ring)     │  │                                      │ │
│  │                       │  │ Card: Beskrivning (omit if empty)    │ │
│  │ Empty: not configured │  │                                      │ │
│  │  / no teams yet       │  │ Card: Källa                          │ │
│  │                       │  │  [ Öppna i SportAdmin ] → source_url │ │
│  └───────────────────────┘  │  Importerad / Uppdaterad             │ │
│                             │  No selection: “Välj ett lag…”       │ │
│                             │  No Form · No Activity · No Info card│ │
│                             └──────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────┘
```

**Phone:** lista först; rad → detail med tillbaka till listan (ingen app-shell DetailPanel).

**Binding:** description as plain text only (no HTML render). Image: optional thumb if `source_image_url`; broken image → hide thumb. External open uses named link + `rel=noopener noreferrer`.

---

### 2.3 Debug — wireframe (text)

```text
┌─ Debug ─────────────────────────────────────────────────────────────┐
│  DetailSection: Discovery                                            │
│  SportAdmin URL: …                                                   │
│                                                                      │
│  START                                                               │
│   ├── Teams: n                                                       │
│   ├── News: n                                                        │
│   ├── Matches: n                                                     │
│   ├── Calendar: n / ⚠                                                │
│   └── Documents/Links: n                                             │
│                                                                      │
│  Expandable: identified resources (id, type, source_url)             │
│  Expandable: errors from last discovery/sync                         │
│                                                                      │
│  Empty before first save: DETAIL_EMPTY_STATE “Kör connection test    │
│  eller sync för att fylla discovery.”                                │
└──────────────────────────────────────────────────────────────────────┘
```

Monospace or `text-sm` tree is fine; no inventing a graph UI. Read-only.

---

### 2.4 Copy (Swedish, MVP)

| Context                    | Copy                                                                              |
| -------------------------- | --------------------------------------------------------------------------------- |
| Plugin title               | SportAdmin                                                                        |
| Subtitle                   | Publik information från föreningens SportAdmin-webb                               |
| URL label                  | SportAdmin URL                                                                    |
| URL help                   | Ange den publika webbplatsen. Homebase loggar aldrig in och sparar inga lösenord. |
| Sync now                   | Synka nu                                                                          |
| View errors                | Visa fel                                                                          |
| Stale banner               | SportAdmin kunde inte nås. Visar sparad data från {datetime}.                     |
| Partial calendar           | Kalenderfeed hittades inte (HTML-kalender kan ändå vara importerad).              |
| Not configured             | Ange en URL och spara för att ansluta.                                            |
| Source line                | Källa: {orgName} / SportAdmin                                                     |
| Teams empty not configured | Ange SportAdmin URL under Integration och spara för att importera lag.            |
| Teams empty no teams       | Inga lag importerade ännu.                                                        |
| Teams select prompt        | Välj ett lag i listan.                                                            |
| Teams open source          | Öppna i SportAdmin                                                                |
| Teams no source            | Ingen källänk.                                                                    |

---

### 2.5 Navigation / registry (Frontend guidance)

- Sidebar entry: **SportAdmin** (plugin enabled via tenant access).
- Single plugin page using settings shell categories (Integration / Teams / Debug).
- **Do not** convert the whole plugin to Contacts-class List/View/Form/QC from `PLUGIN_VIEW_IMPLEMENTATION_GUIDE.md`.
- **Do** embed read-only list|detail chrome **inside** the Teams category; follow settings sections of the guide + `UI_AND_UX_STANDARDS_V3.md` §3.2: `PluginSettingsPageShell`, filled inputs, `DetailSection`, status badges, `RoundIconLabelButton`.

---

## 3. Återanvändning

| Pattern            | Reuse                                                                       |
| ------------------ | --------------------------------------------------------------------------- |
| Settings shell     | `PluginSettingsPageShell`, `SettingsHeaderSaveButton`                       |
| Sections           | `DetailSection` + `SETTINGS_CATEGORY_ICONS`                                 |
| Fields             | `FORM_INPUT_CLASS`, Label, Input                                            |
| Actions            | `RoundIconLabelButton` (Sync = secondary like Matches CloudDownload)        |
| Status             | `StatusOutlineBadge` + `QC_STATUS_BADGE_COLORS`                             |
| Counts             | `ListFilterStatCard` (display-only on Integration)                          |
| Filters            | `LIST_FILTER_CHIP_*`                                                        |
| Empty              | `DETAIL_EMPTY_STATE_CLASS`                                                  |
| Closest references | `MatchSettingsView`, Cups import status language, provider Connected badges |

**New patterns required:** none. Connection-test checklist is a simple success/warning list inside `DetailSection` (text rows + icon), not a new component library.

---

## 4. Tillgänglighet och responsivitet

- Status not by color alone: badge includes text (“Connected”, “Partial”, …).
- Sync now and Save have clear labels; busy state via `aria-busy` / disabled.
- Filter chips: button role, pressed state via active chip class; keyboard focus visible (existing chip styles).
- External images: meaningful `alt` (news title) or empty alt if decorative.
- Source link: discernible name (“Öppna i SportAdmin”) when linking `source_url`.
- Phone: settings shell already swaps bottom bar to Close (+ Save when dirty); stacked sections scroll; chip rows wrap (`LIST_FILTER_CHIP_ROW_CLASS`).
- Touch targets: use existing `RoundIconLabelButton` / chip sizes — do not shrink below platform norms.
- Contrast: muted help text on standard background; warning banner uses warning token, not low-contrast gray-on-gray.

---

## 5. Teknisk genomförbarhet

Avstämt mot Architect ADR:

| Design need                  | API / constraint                             |
| ---------------------------- | -------------------------------------------- |
| Status + counts + timestamps | `GET /api/sportadmin`                        |
| Save URL + test              | `POST /api/sportadmin/config`                |
| Sync now                     | `POST /api/sportadmin/sync`                  |
| Errors                       | `GET /api/sportadmin/errors`                 |
| Debug tree                   | `GET /api/sportadmin/discovery`              |
| Teams data                   | `GET /api/sportadmin/teams`                  |
| Partial calendar ⚠          | Non-fatal connection-test field              |
| Stale banner                 | `last_successful_sync` + `last_error`        |
| No app-root `/api/teams`     | Teams pane talks only to `/api/sportadmin/*` |
| No interval picker           | Refresh interval not shown in UI             |

**Teams category** is a shell tab (Integration / Teams / Debug) — preferred for discoverability in beta.

---

## 6. Angränsande förbättringsmöjligheter (utanför scope)

- Senare: intervallväljare (15 min–dygn) i Integration.
- Senare: attribution toggle “visa källa på publik sajt”.
- Senare: återanvända Teams list|detail (eller news/matches) som dashboard widgets på Home.
- Flagga till TPM: home dashboard saknar generisk “content connector”-widget-slot — ej del av denna MVP.

---

## 7. Överlämning

Till **Frontend Developer** (efter eller parallellt med Backend enligt TPM): implementera Integration / Teams / Debug enligt detta paket och ADR API-kontrakt. Teams = read-only list|detail inbäddad i settings-kategori — ingen Contacts CRUD-shell.

Backend behöver statusfält och connection-test payload som speglar ✓/⚠-raderna; Designer kräver inga ytterligare visuella varianter.

```handover
Status: Approved
Workflow State: Passed
Current Role: UI/UX Designer
Reason: Design package amended — Demo replaced by Teams read-only list|detail; Integration and Debug unchanged.
Blocking Decisions: None
Deliverables:
  - docs/ai/design/SPORTADMIN_CONNECTOR_UX.md
  - User flows A–E (connect, sync, debug, teams, stale)
  - Wireframes for Integration, Teams, Debug
  - Swedish MVP copy
  - Reuse map (PluginSettingsPageShell, DETAIL_VIEW cards, StaleBanner, RoundIconLabelButton)
Risks:
  - Over-building Contacts CRUD mail-layout would break beta simplicity — explicitly out of design
  - Showing unsanitized HTML would create XSS UX risk — description is plain text only
Scope Changes:
  - Demo widgets removed; replaced by Teams list|detail
Requires User Input: No
User Decision: N/A
Handover Version: 1.0
```

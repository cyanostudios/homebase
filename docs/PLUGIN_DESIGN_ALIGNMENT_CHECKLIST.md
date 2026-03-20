# Checklista: design för nästa plugin (slots/notes-mönster)

Använd denna lista när ni justerar **list-, settings-, detail- och App-integration** för ett plugin så att det matchar referensplugin **slots** (och **notes** där den följer samma linje). Gå igenom A–H punkt för punkt och jämför med befintlig kod i `client/src/plugins/slots/` och `client/src/plugins/notes/`.

---

## A. App / global shell (`client/src/App.tsx`)

- [ ] **`contentFlush`:** Lägg till pluginets `currentPage === '…'` i `MainLayout`-prop `contentFlush` (samma beteende som `slots` och `notes` – fullbredd innehåll utan extra global padding där det är avsett).
- [ ] **`contentTitle` / `contentIcon`:** Tomma eller minimala värden om listan har **egen lokal titel/toolbar** (undvik dubbel rubrik).
- [ ] **`primaryAction`:** I **list-läge** ska primär global action ofta vara **null** om "Lägg till" / huvud-CTA ligger i listans toolbar; i **settings** ska **Close** ligga **inline** i settings-vyn, inte bara som global primary.
- [ ] **Settings close:** Säkerställ att `getContentPrimaryAction` / `closeXSettingsView` följer samma mönster som slots/notes (inline Close + ev. kategoriknappar).

---

## B. Listvy (`*List.tsx`)

- [ ] **Yttre wrapper:** Samma visuella rytm som detail (bakgrund, padding, radius, ev. offset) som i referens – jämför med `client/src/plugins/slots/components/SlotsList.tsx` och motsvarande notes-lista.
- [ ] **Lokal toolbar:** Sök, filter, **Settings**-knapp (`t('…settings')` i `client/src/i18n/locales/en.json` / `sv.json`), **Add** – inte beroende av global `ContentToolbar` / `setHeaderTrailing` om målet är slots-mönster.
- [ ] **Tabell / grid:** Följ `UI_AND_UX_STANDARDS_V3.md`: checkbox-kolumn `w-12`, rad-hover, klickbar rad, **BulkActionBar ovanför** kortet (inte inuti under tabellen).
- [ ] **Tomt tillstånd:** Samma typografi/spacing som referensplugin.
- [ ] **Mobil:** Enhetlig tabell/grid-strategi (undvik helt separata grenar om referensen använder en gemensam layout).

---

## C. Settings-vy (`*SettingsView.tsx`)

- [ ] **Header inline:** Samma mönster som slots: t.ex. `renderCategoryButtonsInline`, `inlineTrailing` (Close + ev. kategorier i samma rad).
- [ ] **Ingen dubbel global primary** för Close om det redan finns inline.

---

## D. Detail / view (`*View.tsx`)

- [ ] **Layout:** Använd gemensamma komponenter där det finns: t.ex. `client/src/core/ui/DetailLayout.tsx` / `DetailPanel.tsx` – följ befintlig **DetailActivityLog**-integration om pluginet loggar aktivitet.
- [ ] **Quick actions:** `items-start`, **inga** fullbredds grå action-rader; **ikonfärger** via samma hjälpare som slots (`getActionIconColorClass` eller motsvarande): t.ex. redigera blå, radera röd, duplicera grön.
- [ ] **Footer actions:** Undvik att lägga **grön knapptext** på sekundära plugin-actions (t.ex. "skapa uppgift från …") om de inte är primär CTA – följ notes/slots-kontextmönster.
- [ ] **Kontakter / nämnda entiteter:** Om plugin visar relaterade kontakter – följ **slots-rader**: sektionsrubrik i muted box, `rounded-lg border`, meta-rad (`email · phone`), smal kolumn med **ikon-only** `ExternalLink` + `sr-only` / `aria-label`.
- [ ] **`useMemo` / stabila listor:** Unika ID-listor från mentions m.m.; jämför `String(id)` mot API-data där typer kan skilja sig.

---

## E. Form (`*Form.tsx`)

- [ ] Fält, validering och avbryt/spara i linje med detail footer/header enligt `UI_AND_UX_STANDARDS_V3.md` (verktyg i header, tillstånd i footer där det är etablerat).
- [ ] **Samma kort och ordning som i vy:** Om referensplugin (t.ex. **slots**) delar upp huvudkolumnen i flera `Card` i **view**, gör motsvarande uppdelning i **edit** – inte allt i ett enda formulärkort om vyn använder separata kort (t.ex. slotfält → **egenskaper** → **kontakter**).
- [ ] **Egenskaper-kort (slots-mönster):** Eget `Card` med `p-6 space-y-2`, sektionsrad med ikon i `h-7 w-7` muted-ruta (`SlidersHorizontal` för slots), rubrik `slots.properties`, därefter ramade rader (`rounded-lg border border-border p-4`) + `Switch` med samma storleksklasser som i `SlotView` om ni kopierar beteendet.
- [ ] **Kontakter-kort (slots-mönster):** Eget `Card` som i `SlotSettingsCard` / `SlotView`: `Users`-ikon + rubrik `common.contacts` på **samma rad** som add-fältet (`flex-col gap-2 sm:flex-row sm:items-center sm:justify-between`). Add i vy använder **Popover + `Input` + sökikon** – använd samma mönster i edit om ni ska vara 1:1 (inte bara `Select`), inkl. `PopoverContent`-lista. Valda kontakter som **rader** `rounded-lg border border-border p-4`, `User` + namn + valfri meta-rad + sekundär radera-knapp som i vy – inte bara chip-rader om vyn använder kort-rader.
- [ ] **Gemensamma klasser:** Återanvänd samma kortklasser som vy (`SLOT_DETAIL_CARD_CLASS` / motsvarande) eller samma visuella tokens (`border-border/70`, `bg-card`, `shadow-sm`) så edit och view inte divergerar.

---

## F. Context (`*Context.tsx`)

- [ ] **Panel-actions:** `detailFooterActions` / `detailHeaderActions` – inga avvikande färgklasser som bryter quick-action-policyn.
- [ ] **Ingen onödig `setHeaderTrailing`** om listan sköter sin egen toolbar.

---

## G. i18n

- [ ] Nya strängar för settings/toolbar i **både** `en.json` och `sv.json`.

---

## H. Kvalitet före merge

- [ ] **Ingen horisontell scroll** i list/detail på smal viewport.
- [ ] **Lint** på ändrade filer (`npm run lint` eller motsvarande).
- [ ] **Regression:** öppna/stäng panel, skapa/redigera/radera, settings in/ut – se `LESSONS_LEARNED.md` (plattformsstabilitet).
- [ ] **Efter ändring i form:** Öppna **edit-läge** explicit (vit sida = ofta runtime-fel). Kolla webbkonsolen.

---

## I. Implementationsinstruktioner (undvik vanliga fel)

### React hooks och vit sida

- [ ] **`useMemo` / `useCallback` får inte köras före `useState` som de läser.** Om en memoized beräkning använder t.ex. `selectedContactIds` eller `contactSearch` måste motsvarande `useState` deklareras **före** den `useMemo`/`useCallback`. Annars: _temporal dead zone_ → `ReferenceError` → React kraschar → **blank sida** i edit (eller hela vyn).
- [ ] **Regel:** Ordna hooks top-down: contexts → övriga hooks → `useState` som behövs tidigt → `useMemo`/`useCallback` som beror på den staten → resterande `useState`/`useEffect` i stabil ordning. Ändra inte hook-ordning mellan renders.

### Jämför side-by-side vid alignering

- [ ] Öppna **`SlotView.tsx`** (eller motsvarande `*View.tsx`) och **`SlotForm.tsx`** (eller `*Form.tsx`) i två fönster: samma sektion ska ha samma **DOM-struktur** (kort → rubrikrad → innehåll) och samma **Tailwind-mönster** där det är meningsfullt.
- [ ] **Kontakt-add:** Filtrering/sök i popover ska följa samma fält som i vy (namn, e-post, telefon) om ni kopierar `filteredContactSuggestions`-logiken.

### i18n

- [ ] Återanvänd befintliga nycklar (`slots.properties`, `common.contacts`, `common.addContact`, `slots.noMoreToAdd`, `common.noResults`) i stället för nya strängar när beteendet är identiskt med slots.

---

## Referensdocs (läs vid behov)

| Dokument                             | Innehåll                                     |
| ------------------------------------ | -------------------------------------------- |
| `UI_AND_UX_STANDARDS_V3.md`          | Tabell, grid, detail header/footer, metadata |
| `PLUGIN_DEVELOPMENT_STANDARDS_V2.md` | Context-kontrakt, naming                     |
| `MENTIONS_AND_CROSS_PLUGIN_UI.md`    | Om plugin har @mentions / länkar             |

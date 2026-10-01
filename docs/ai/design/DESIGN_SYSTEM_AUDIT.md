# Design system audit — färger och komponentinventering

**Datum:** 2026-09-30  
**Status:** Analys only — inga kodändringar, inga designbeslut i detta dokument.  
**Syfte:** Underlag för en kommande designmall och riktlinjer (streamline av tokens, komponenter, ikoner, typografi).  
**Referensbilder:** Wint-skärmdumpar i Cursor assets (`screencapture-wint-saltfish-ai-demobolaget-ab-*`, 11 unika vyer).  
**Hex-metod:** Pixelklustring (mättade + neutrala) på konverterade PNG:er; värden avrundade till närmaste stabila kluster.

Relaterade dokument:

- [`docs/UI_AND_UX_STANDARDS_V3.md`](../../UI_AND_UX_STANDARDS_V3.md) — gällande appstandard
- [`docs/PUBLIC_APP_DESIGN.md`](../../PUBLIC_APP_DESIGN.md) — publika sajter
- Tokens: [`client/src/index.css`](../../../client/src/index.css), [`tailwind.config.ts`](../../../tailwind.config.ts)

---

## 1. Referensfärger (Wint)

### 1.1 Rollpalett (pipetterad)

| Roll                            | Hex (pipett)                                             | Användning i referensen                                            |
| ------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| Page background                 | `#F4F4F0` / `#F6F5F3`                                    | Arbetsyta bakom kort (varm off-white, inte kall blågrå)            |
| Card / sidebar / paper          | `#FFFFFF` / `#FCFCFC`                                    | Kort, sidomeny, fakturaförhandsvisning, modal                      |
| Input / muted fill              | `#F0F0EC` / `#F0ECE8`                                    | Fyllda fält, filterdrawer, modal-overlay-blandning                 |
| Heading / body navy             | `#1E4164` / `#204267` / `#2C4054`                        | Rubriker, donut-huvudsegment, brödtext-ton                         |
| Muted text / icons              | `#5B7288` (approx)                                       | Sekundärtext, inaktiva ikoner                                      |
| Primary cyan                    | `#37B9F5` / `#36B9F6` / `#3EB7F4`                        | FAB, aktiva nav, primärknappar, diagram innevarande period, ikoner |
| Primary cyan deep (filled card) | `#0F9BF0` / `#0DA0F3`                                    | Helblått sammanfattningskort (kundvy)                              |
| Primary light                   | `#C1E7F7` / `#B8E1F4` / `#A4D7F3`                        | Diagram jämförelseår, badge-bakgrund, soft accents                 |
| Success CTA green               | `#42D97F` / `#41D77D`                                    | Massiva knappar: Godkänn, Slutgranska                              |
| Success soft                    | `#C2F6CE` / `#C4F6D3`                                    | Status “bokförd/betald”, kreditbetyg-bubbla                        |
| Warning soft / yellow           | `#ECD5B8` (amber soft); gul i donut ~`#F9D84A` (visuell) | “Att godkänna”, kategori-pastell                                   |
| Danger / alert                  | `#DC8291` / notis-röd (visuell `#E8385A`)                | Notisbadge, negativa %, varningsikon                               |
| Danger soft / pink              | `#E8AFB6` / `#F1C1C4` / `#DF8694`                        | Status “förfallen”, donut-rosa                                     |
| Selected row tint               | `#C1DDEE` / `#F4F8FC`                                    | Markerad tabellrad / filter                                        |
| Category pastels                | mint `#C2F6CE`, rosa `#E8AFB6`, gul/amber soft           | Rapportkategori-ikoncirklar                                        |

### 1.2 Färgmönster i referensen

1. **En primärfärg** — cyan används till allt interaktivt (nav, FAB, länkar, filter-CTA, diagram “nu”).
2. **Grönt är slutsteg** — endast bekräftande massiva CTA (Godkänn / Slutgranska), inte generell primär.
3. **Status = ljus bakgrund + mättad text** — aldrig mättad fylld badge som default.
4. **Varma neutraler** — page `#F4F4F0`, inte kall slate/blue-gray.
5. **Diagram = samma hue, två värden** — mättad + ljus cyan (år A/B); navy som andra serie.
6. **Kategoriikoner på pastellbrickor** — mint / gul / rosa cirklar med linjeikon inuti.

### 1.3 Komponenttyper som syns i referensen (färgsammanhang)

Sidebar, top search, company switcher, notisbadge, avatar, accordion todo, quick-action icon cards, support/news rail, bar/donut/line charts, KPI-rader, data tabell + status pills, pagination, filter drawer, modal, FAB-stack, steppad fakturaform (preview + steg), grön slut-CTA.

---

## 2. Nuläge Homebase — färg

### 2.1 Tokenkälla

| Källa                                                   | Roll                                                                                            |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [`client/src/index.css`](../../../client/src/index.css) | `:root` / `.dark` HSL-tokens (shadcn) + plugin-accenter                                         |
| [`tailwind.config.ts`](../../../tailwind.config.ts)     | Mappar tokens → utilities; **överstyr** `slate`/`gray` mid–dark; `chart.1–5` utan CSS-variabler |
| [`components.json`](../../../components.json)           | shadcn `new-york`, `baseColor: neutral`, `cssVariables: true`                                   |
| Dark mode                                               | `darkMode: ['class']` + `useTheme` / FOUC-script i `client/index.html`                          |

### 2.2 Kärntokens (light)

| Token                  | HSL / värde    | Ungefärlig hex                   |
| ---------------------- | -------------- | -------------------------------- |
| `--background`         | `210 40% 96%`  | kall gråblå yta                  |
| `--foreground`         | `220 25% 19%`  | body text                        |
| `--card`               | `0 0% 100%`    | vit                              |
| `--primary`            | `200 100% 48%` | `#009EF7`                        |
| `--secondary`          | `220 15% 90%`  |                                  |
| `--muted`              | `210 15% 95%`  |                                  |
| `--muted-foreground`   | `220 35% 11%`  | mörk (ovanligt tung för “muted”) |
| `--workspace`          | `#ffffff`      |                                  |
| `--destructive`        | `348 86% 56%`  | `#F1416C`                        |
| `--border` / `--input` | `220 15% 90%`  |                                  |
| `--radius`             | `0.5rem`       |                                  |

Sidebar-tokens speglar primary/workspace. **15 plugin-accenter** (`--plugin-notes` … `--plugin-teams`) + utilities `.bg-plugin-subtle`, `.text-plugin`, m.fl.

**Saknas som semantiska tokens:** `success`, `warning`, `info`, `--chart-1…5` (Tailwind pekar på dem men CSS definierar dem inte).

### 2.3 Användningsstatistik (`client/src`)

Ungefärliga räknare (ripgrep, 2026-09-30):

| Kategori                                                                          | Omfattning                                                                            |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Semantiska klasser (t.ex. `text-muted-foreground`, `bg-primary`, `border-border`) | ~3 020 träffar totalt i tidigare inventering; `text-muted-foreground` ensam **1 049** |
| Råa Tailwind-paletter (`text-slate-*`, `text-red-*`, …)                           | ~2 513                                                                                |
| Hex-literaler `#…`                                                                | **163**                                                                               |
| `text-red-*`                                                                      | **293**                                                                               |
| `text-green-*`                                                                    | **130**                                                                               |
| `bg-amber-*`                                                                      | **60**                                                                                |
| `text-slate-400`                                                                  | **167** (vanligaste råa klassen)                                                      |

**Toppfiler med hex / rå palett:** `plugins/teams/types/teams.ts`, `plugins/requests/types/requests.ts`, `InvoicesStatisticsView.tsx`, `DetailActivityLog.tsx`, `ImportWizard.tsx`, `invoices/webTemplate.ts`, `estimates/webTemplate.ts`.

**Statusfärger i kod idag** går via råa klasser i [`badgeStyles.ts`](../../../client/src/core/ui/badgeStyles.ts) (`QC_STATUS_BADGE_COLORS`: slate/blue/emerald/red/amber/violet/orange) — **inte** via `--success` / `--warning`.

### 2.4 Publika sajter (separata öar)

| Yta                    | Brand                     | Page bg   | Text                        |
| ---------------------- | ------------------------- | --------- | --------------------------- |
| `public-clubdesk`      | violet `hsl(262 83% 58%)` | `#f9fafb` | `#111827`                   |
| `public-cups`          | teal `#099ea2`            | `#f4f8f8` | `#0f172a`                   |
| `public-booking`       | blue `#2563eb`            | `#f8fafc` | `#1e293b` (+ success/error) |
| `public-instructions`  | coral `hsl(16 100% 60%)`  | `#f7f1ea` | `#1a1c1e`                   |
| `templates/public-app` | green `hsl(128 39% 25%)`  | `#f7f9f8` | `#1a1c1e`                   |

Ingen delar SPA:ns `--primary` / dark-mode-klass. Se [`PUBLIC_APP_DESIGN.md`](../../PUBLIC_APP_DESIGN.md).

### 2.5 Mappning Wint-roll → Homebase

| Wint-roll         | Homebase idag                                                   | Gap                                           |
| ----------------- | --------------------------------------------------------------- | --------------------------------------------- |
| Page `#F4F4F0`    | `--background` kall `210 40% 96%` + ofta `bg-slate-100` i shell | Ton skiljer (varm vs kall)                    |
| Card white        | `--card` / `--workspace`                                        | Matchar                                       |
| Primary cyan      | `--primary` `#009EF7`                                           | Nära Wint `#37B9F5`; liten hue/värde-skillnad |
| Primary light     | ad-hoc `bg-sky-*` / `bg-primary/10`                             | Ingen `primary-muted` token                   |
| Navy headings     | blandat `foreground` / `slate-*` / hex                          | Ingen `heading` token                         |
| Success CTA green | `RoundIconLabelButton` `success` + rå `green-*`/`emerald-*`     | Ingen `--success`                             |
| Warning           | rå `amber-*` / `yellow-*`                                       | Ingen `--warning`                             |
| Danger            | `--destructive` + rå `red-*`                                    | Delvis; status soft-fills saknas som tokenpar |
| Chart series      | hårdkodad hex i SVG-charts                                      | `--chart-*` odefinierade                      |
| Category pastels  | plugin-accenter (annan modell)                                  | Olika koncept                                 |

---

## 3. Komponentinventering

### 3.1 Lageröversikt

| Lager                         | Sökväg                             | Antal                               |
| ----------------------------- | ---------------------------------- | ----------------------------------- |
| Primitiver (shadcn-stil)      | `client/src/components/ui/`        | **24** `.tsx`                       |
| App-shell / domän-UI          | `client/src/core/ui/`              | **97** `.tsx` (+ stilhelpers `.ts`) |
| Plugin feature-komponenter    | `client/src/plugins/*/components/` | **315** `.tsx`                      |
| Plugin-lokala `components/ui` | —                                  | **0**                               |
| Plugins                       | `client/src/plugins/*`             | **23**                              |

### 3.2 Primitiver (`components/ui`)

| Komponent                                         | Importfiler (approx) | Variabler / not                                                                                       |
| ------------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------- |
| `Button`                                          | **138**              | cva: default/primary, secondary, outline, ghost, link, destructive/danger; size default/sm/md/lg/icon |
| `RoundIconLabelButton` (+ `ExpandableIconButton`) | **119**              | primary, soft, secondary, category, success, successSoft, danger, dangerSoft; size xs/sm/md           |
| `Card`                                            | **109**              | padding none/sm/md/lg; `shadow-none` ⇒ `border-0`                                                     |
| `Input`                                           | ~74                  |                                                                                                       |
| `Select` / `NativeSelect`                         | ~61                  |                                                                                                       |
| `Label`                                           | ~51                  |                                                                                                       |
| `Badge`                                           | **42**               | default, secondary, destructive, outline (default outline)                                            |
| `DropdownMenu`                                    | ~23–24               |                                                                                                       |
| `AlertDialog`                                     | **24**               |                                                                                                       |
| `Switch`                                          | ~21                  |                                                                                                       |
| `Textarea`                                        | ~18                  |                                                                                                       |
| `Popover`                                         | ~16–18               |                                                                                                       |
| `RoundExpandableSearch`                           | ~24                  |                                                                                                       |
| `Table`                                           | **9**                |                                                                                                       |
| `Checkbox`                                        | ~6                   |                                                                                                       |
| `RoundExpandableQuickAdd`                         | **5**                | FAB-lik quick-add                                                                                     |
| `Collapsible`                                     | ~4                   |                                                                                                       |
| `ScrollArea`                                      | ~3                   |                                                                                                       |
| `Sheet`                                           | **2**                |                                                                                                       |
| `Tooltip`                                         | **1**                | nästan död                                                                                            |
| `Separator`                                       | **1**                |                                                                                                       |
| `sidebar` (shadcn)                                | **0**                | död parallell till `core/ui/Sidebar`                                                                  |
| `navigation-menu`                                 | **0**                | död                                                                                                   |

### 3.3 Per kategori — paralleller och överlapp

#### Knappar

| Implementation         | Path                                        | Användning                                             |
| ---------------------- | ------------------------------------------- | ------------------------------------------------------ |
| `Button`               | `components/ui/button.tsx`                  | 138 filer                                              |
| `RoundIconLabelButton` | `components/ui/round-icon-label-button.tsx` | 119 filer — **dominans i toolbar/dialog/rail**         |
| `DialogRoundButtons`   | `core/ui/DialogRoundButtons.tsx`            | dialog-wrappers                                        |
| Rå `<button>`          | plugins + core                              | **~92** taggar; **38** plugin-filer, **17** core-filer |

Standarddokumentet blandar: list-toolbar §3.1 säger `Button secondary sm`; shell/dialogs §4.0 säger `RoundIconLabelButton`.

#### Dialoger / overlay

| Implementation                                                               | Användning         |
| ---------------------------------------------------------------------------- | ------------------ |
| `AlertDialog`                                                                | 24                 |
| `ConfirmDialog`                                                              | **68**             |
| `BulkDeleteModal`, `DuplicateDialog`, `BulkEmailDialog`, `BulkMessageDialog` | core delade        |
| `dialogStyles` / `DialogHeading`                                             | delade tokens      |
| `Sheet`                                                                      | 2 (mobil nav m.m.) |
| Plugin `*Dialog*` / `*Modal*`                                                | **28** filer       |
| Standalone `Dialog`, `Drawer`, Toast/Sonner                                  | **saknas**         |

#### Tabeller

| Implementation          | Antal                        |
| ----------------------- | ---------------------------- |
| `ui/table`              | 9 importörer                 |
| `SortableListTable`     | **23** — kanonisk list-shell |
| Plugin `*ListTable.tsx` | **24**                       |

#### Kort / detail

| Implementation                                                   | Antal                                       |
| ---------------------------------------------------------------- | ------------------------------------------- |
| `Card`                                                           | 109                                         |
| `DetailSection` + `detailViewCardStyles`                         | **142** DetailSection — dominant detail-yta |
| `DetailCard`                                                     | **0 externa imports** (död)                 |
| `ListFilterStatCard`, `DashboardKpiCard`, `SettingsCategoryCard` | specialiserade                              |

#### Badge / chip / status

| Implementation                                 | Antal               |
| ---------------------------------------------- | ------------------- |
| `Badge` (cva)                                  | 42                  |
| `StatusOutlineBadge`                           | 34                  |
| `badgeStyles` (`BADGE_CHIP_*`, `QC_STATUS_*`)  | 59                  |
| `ListFilterChipsToggle` + `LIST_FILTER_CHIP_*` | listfilter / “tabs” |
| Plugin `*Badge*`                               | få one-offs         |

**Obs:** V3-standarden föreskriver outline/text-only status (`BADGE_CHIP`); Wint använder fyllda soft pills. Konflikt vid framtida mall.

#### Formulär

- `Input`, `Textarea`, `PasswordInput`, Radix `Select` + `NativeSelect`
- **15** domän-`*Select.tsx` i plugins (tasks/requests/invoices/estimates/cups/teams)
- **Ingen** delad Combobox/cmdk
- Ghost-fält: `formFieldStyles.ts` (`FORM_GHOST_*`)

#### Navigation / shell

- Live: `core/ui/Sidebar.tsx`, `sidebar/*`, `AppRightSidebar`, `MobileBottomBar`, `MobileShellControls`
- Död: `components/ui/sidebar.tsx`, `navigation-menu.tsx`
- Tabs-primitiv: **saknas** (ersätts av filter chips / header menus)

#### Empty / header

- `ListEmptyState` — 27
- `ContentHeader` — via `MainLayout`
- `DetailHeaderMenus` + ~20 plugin `*DetailHeaderMenus`

#### FAB / quick-add

- `RoundExpandableQuickAdd` — 5 consumers
- Ingen global Wint-lik FAB-stack (chat + plus)

### 3.4 Saknade / döda primitives (sammanfattning)

**Saknas:** Tabs, Toast, Combobox, generisk Dialog, Drawer, komplett FAB-system, semantiska success/warning/info-färgtokens, `--chart-*`.

**Döda / nästan döda:** shadcn `sidebar`, `navigation-menu`, `DetailCard`, `Tooltip` (~1), `Separator` (~1).

---

## 4. Ikoner, typografi, radie, skugga, spacing

### 4.1 Ikoner

| Faktum            | Värde                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------- |
| Bibliotek         | **endast** `lucide-react` (^0.453.0)                                                              |
| Importställen     | **345** filer / ~348 sites                                                                        |
| Distinkta ikoner  | **~181**                                                                                          |
| Toppikoner        | Trash2, X, Plus, Users, LayoutGrid, CheckCircle2, ArrowUp/Down, Info, Check, SlidersHorizontal, … |
| Storlekar         | `h-3.5` dominant (~237), även `h-3`, `h-4`, `h-5`, `size={14}`, m.fl. (**≥8** storlekar)          |
| Custom SVG React  | `TomatoIcon.tsx` (pomodoro)                                                                       |
| `public-clubdesk` | **~52** inline `<svg>` (ej Lucide)                                                                |

### 4.2 Typografi

| Faktum         | Värde                                                                         |
| -------------- | ----------------------------------------------------------------------------- |
| Appfonter      | Mulish (self-host) + Poppins (Google; `font-poppins` sällan)                  |
| Tailwind scale | xs 12 → 3xl 29; **base = 15px**                                               |
| Vanligast      | `text-xs` ~873, `text-sm` ~863                                                |
| Arbitrary      | `text-[10px]` **172**, `text-[11px]` **74**, totalt ~250 arbitrary text sizes |
| Vikter         | medium 402, semibold 293, extrabold 215, bold 19                              |
| Sidtitel       | `PLUGIN_PAGE_TITLE_CLASS` = `text-2xl font-extrabold tracking-tight`          |
| Detail labels  | ofta `text-[10px] uppercase tracking-[…]`                                     |

Public Clubdesk: egen skala `--fs-xs` 11px … `--fs-display` 2rem; Poppins.

### 4.3 Radie

| Klass            | Antal (`client/src`) |
| ---------------- | -------------------: |
| `rounded-md`     |                  274 |
| `rounded-full`   |                  168 |
| `rounded-lg`     |                  114 |
| `rounded-xl`     |                  107 |
| Token `--radius` |             `0.5rem` |

Fyra konkurrerande nivåer + pills. Public sites: `--r-sm`…`--r-2xl` / pill (olika px per app).

### 4.4 Skugga

| Klass         | Antal |
| ------------- | ----: |
| `shadow-none` |   100 |
| `shadow-sm`   |    65 |
| `shadow-xl`   |    63 |
| `shadow-lg`   |    17 |
| `shadow-md`   |     9 |

Kort i dashboard-standard: ofta `shadow-sm`; många ytor medvetet `shadow-none`.

### 4.5 Spacing

Dominanta steg: `gap-2`, `gap-3`, `px-3`, `gap-1.5`, `p-6`, `p-4`, `space-y-4`. Arbitrary layout-värden (~773 stil-liknande `-[…]` exkl. data-selectors).

### 4.6 Diagram

- Inget recharts/Chart.js — custom SVG i `core/ui/charts/StatCharts.tsx` + dashboard-donuts/bars
- Färger hårdkodade hex (`#94a3b8`, `#3b82f6`, `#10b981`, …)
- Tailwind `chart-1…5` oanvända

---

## 5. Avvikelser mot `UI_AND_UX_STANDARDS_V3.md`

| Standard säger                                      | Kod / verklighet                                                              | Gap                             |
| --------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------- |
| Semantiska tokens + plugin-färger                   | ~45 % rå palett + 163 hex                                                     | Token-läckage                   |
| Status via `BADGE_CHIP` / outline, ingen fill       | Wint-referens = soft filled pills; `Badge` cva har filled variants parallellt | Två badge-språk                 |
| List toolbar: `Button secondary sm` (§3.1)          | Dominerande chrome: `RoundIconLabelButton` (§4.0)                             | Dubbel knappregel               |
| `DetailCard` eller `Card` för grid (§2)             | Grid-listor borttagna; `DetailCard` oanvänd; detail = `DetailSection`         | Dokument eftersläpar            |
| Page surface `bg-background` / shell `bg-slate-100` | Kall gråblå; Wint varm `#F4F4F0`                                              | Ton                             |
| Micro-copy `text-[10px]` tillåten                   | 172+ förekomster + `text-[11px]`                                              | Skalan fragmenterad             |
| Icon size i round buttons standardiserad            | Lucide fortfarande många storlekar utanför knappar                            | Ikon-skala                      |
| Chart utilities                                     | `--chart-*` saknas                                                            | Ofärdig tokenyta                |
| Public Clubdesk i V3 nämns violet/`#f9fafb`         | Stämmer med `public-clubdesk`; **skiljer** från SPA primary cyan              | Medveten split, ej en mall      |
| shadcn sidebar i repo                               | 0 imports                                                                     | Död kod vs “Premium primitives” |

---

## 6. Öppna frågor (beslut krävs innan mall)

Inga beslut tas här — endast frågor till UI/UX + arkitekt:

1. **Neutral bakgrund:** byta SPA till Wint-lik varm `#F4F4F0`, behålla kall `210 40% 96%`, eller ny hybrid?
2. **Primär hex:** behålla `#009EF7` eller flytta mot Wint `#37B9F5` / `#0F9BF0`?
3. **Success/warning/info tokens:** införa CSS-variabler + utilities, eller fortsätta `QC_STATUS_BADGE_COLORS` + råa klasser?
4. **Statusbadge-språk:** behålla text-only outline (nuvarande V3) eller anta Wint soft-fill pills (kräver V3-uppdatering)?
5. **Knapptyp:** en kanon — `Button` _eller_ `RoundIconLabelButton` per yta (list toolbar / dialog / rail) med tydlig matris?
6. **Publika sajter:** behålla brand-öar, eller gemensam token-kontrakt med appens semantiska roller (brand skiljer, roller samma)?
7. **Radie:** hur många nivåer (förslag: sm/md/lg + full)?
8. **Ikonstorlek:** hur många (förslag: 14 / 16 / 20)?
9. **Död kod:** ta bort shadcn `sidebar`, `navigation-menu`, `DetailCard` i hygiene-pass?
10. **Saknade primitives:** prioritera Toast, Tabs, Combobox, Dialog — eller medvetet fortsätta chips + ConfirmDialog?

---

## 7. Rekommenderad nästa fas (inte denna leverans)

1. UI/UX-designer: designmall (färgroller, typeskala, komponentmatris) med beslut på §6.
2. Lösningsarkitekt: tokenkontrakt + migrationsordning (CSS vars → utilities → ersätt råa klasser).
3. Frontend: konsolidera knappar/badges/tabeller enligt mall; UI Hygiene: döda oanvända primitives.
4. Documentation: uppdatera `UI_AND_UX_STANDARDS_V3.md` när besluten är fattade.

---

## 8. Bilaga — snabbkomponenträkning

```
components/ui/*.tsx          24
core/ui/**/*.tsx             97
plugins/*/components/*.tsx  315
plugins                       23
*ListTable.tsx               24
plugin *Dialog*/*Modal*      28
Button imports              138
RoundIconLabelButton        119
ConfirmDialog                68
Card                        109
DetailSection               142
SortableListTable            23
lucide import files         345
```

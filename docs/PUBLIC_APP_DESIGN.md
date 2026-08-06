# Public app design system

**Syfte:** Designregler för [`templates/public-app/`](../templates/public-app/) — mobile-first app-skal (SR-/streaming-inspirerat). Vanilla CSS + vanilla JS (ingen Tailwind/React i mallen).

**Ops / deploy:** [`PUBLIC_APP_TEMPLATE.md`](PUBLIC_APP_TEMPLATE.md).

**Referensimplementation (annan look):** [`public-cups/styles.css`](../public-cups/styles.css) (Cupappen) — **kopiera inte** Cupappen-tokens hit; mallen har eget system. Cupappen-listing använder bl.a. fullbredd frosted `.top-bar`, `.app-atmosphere`, och distrikts-/cup-URL:er dokumenterade i [`public-cups/README.md`](../public-cups/README.md).

---

## Designprinciper

1. **Mobile first** — layouten är en telefonkolumn; desktop speglar samma vy (centrerad `max-width: 440px`), med atmosfärisk bakgrund utanför skalet.
2. **Ett jobb per sektion** — TopBar, QuickNav, rader/grid, detalj/swipe, bottom bar. Inga dashboard-grids i första viewport.
3. **Alltid rounded** — pebble-hörn (`--r-lg` 24px, `--r-xl` 28px, `--r-2xl` 32px, pills).
4. **Vit / ljus yta** — `--bg` vit, `--bg-page` ljus sekundär (`#F7F9F8` default). Brand-accent sparsamt.
5. **Flytande chrome** — bottom bar (och opt-in audio-pod) är `position: absolute` i skalet med hög z-index + `.glass` + `.shadow-float`.
6. **Byt brand/font via tokens** — ändra bara `:root` i `styles.css` per app; behåll klassnamn. Kopiera **inte** instructions coral/beige.
7. **Path-baserad listing** — riktiga URL:er (`/`, `/alla/`, `/info/`, `/kategori/{slug}/`), inte hash-tabs.

---

## Token-kontrakt (per app)

Byt dessa i [`templates/public-app/styles.css`](../templates/public-app/styles.css) `:root` efter kopiering:

| Token             | Default (mall)                | Syfte                      |
| ----------------- | ----------------------------- | -------------------------- |
| `--brand`         | `hsl(128 39% 25%)` Deep Basil | Primär accent              |
| `--brand-hover`   | mörkare brand                 | Hover/active               |
| `--brand-soft`    | brand / 0.09                  | Mjuka ytor                 |
| `--bg`            | `#ffffff`                     | Kort / glass-bas           |
| `--bg-page`       | `#f7f9f8`                     | Skalets bakgrund           |
| `--text`          | `#1a1c1e` Obsidian            | Primär text                |
| `--text-muted`    | `#5d6267` Slate               | Sekundär text              |
| `--font-heading`  | Plus Jakarta Sans             | Rubriker / brand           |
| `--font-body`     | Inter                         | Brödtext                   |
| `--font-display`  | Fraunces                      | Hero / info H1             |
| `--header-h`      | `4rem` / `4.25rem` desktop    | Fast top-barhöjd           |
| `--header-logo-h` | `4.5rem` / `6rem` desktop     | Logo (kan överhänga baren) |

**Gemensamma (byt sällan):** `--r-*`, `--shell-max` (440px), skugg-utilities, z-index-ordning (top 30, chrome 40, drawer 50).

Fonts laddas via Google Fonts `@import` i `styles.css` — byt `@import` + token tillsammans.

---

## Layout (AppShell)

```text
┌─ viewport (mörk .app-bg) ──────────────┐
│         ┌─ .app-shell (440px) ─┐        │
│         │ .app-atmosphere      │        │
│         │ .top-bar (frosted)   │        │
│         │ .app-main (scroll)   │        │
│         │   .hero-band         │        │
│         │     .hero / filter?  │        │
│         │     .quick-nav       │        │
│         │   .item-row / grid…  │        │
│         │ [.audio-pod opt-in]  │        │
│         │ .bottom-bar (float)  │        │
│         └──────────────────────┘        │
└─────────────────────────────────────────┘
```

| Klass             | Roll                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| `.app-bg`         | Mörk blur/radial utanför telefonskalet                                                                 |
| `.app-atmosphere` | Soft brand-blobbar + rutnät **bakom all UI** i skalet (absolut, `z-index: 0`)                          |
| `.app-shell`      | Telefonkolumn, `100dvh`, `overflow: hidden`                                                            |
| `.top-bar`        | Fast höjd `--header-h`; frosted `rgba(255,255,255,0.5)` + blur/saturate; logo via `--header-logo-h`    |
| `.top-bar__inner` | Flex rad: logo + hamburger; `padding: 0 var(--page-pad)`; `height: 100%`                               |
| `.hero-band`      | En komposition: hero-copy + valfri `#shared-filter` + quick-nav; samma vertikal padding som info-panel |
| `.app-main`       | Scroll ovanpå atmosfär (`z-index: 1`); `padding-bottom` för bottom bar                                 |
| `.bottom-bar`     | Flytande pill, `z-index: 40`; default **3 tabs**: Hem \| Alla \| Info                                  |
| `.audio-pod`      | Opt-in: ovanför bottom bar när appen aktiverar ljud (inte default i mall-HTML)                         |

---

## Routing (listing)

| Path                | Vy                                      |
| ------------------- | --------------------------------------- |
| `/`                 | Hem — hero + Netflix-rader per kategori |
| `/alla/`            | Alla — samma rader, utan hero-copy      |
| `/info/`            | Info-panel                              |
| `/kategori/{slug}/` | En kategori — 2-kolumns kortgrid        |
| `/item/:slug`       | SSR-detalj                              |

Klient: `lib/listingUrls.js` (`PublicAppListingUrls`) + `history.pushState` / `popstate`. Bottom bar och meny länkar till path:er, inte `#all` / `#info`.

**Favoriter (opt-in):** Inte i mall-default. Appar som behöver Favoriter lägger tillbaka en tab och egen lagring — se äldre Cupappen-mönster, inte krav i mallen.

---

## Komponentkatalog

| Klass                                                           | Beskrivning                                                               |
| --------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `.quick-nav` / `.quick-nav__badge`                              | Länkar till `/alla/` eller `/kategori/{slug}/`; mobil: horisontell scroll |
| `.hero` / `.hero__title` / `.display-accent`                    | Hero-copy; stora titlar via `--font-display`                              |
| `.info-panel` / `.info-panel__title`                            | Info-tab; samma padding-/display-rytm som hero-band                       |
| `.item-row`                                                     | Hem/Alla: kategori-rubrik + “Visa alla” → kategori-path + scroller        |
| `.item-grid` / `.item-grid-section`                             | Kategori-sida: 2 kolumner, **utan** “Visa alla”                           |
| `.item-card`                                                    | 4:5 kort, gradient-overlay, tag, titel/meta (Netflix-stil)                |
| `.glass`                                                        | Frostad yta (bottom bar / opt-in audio-pod — **inte** top-bar)            |
| `.shadow-soft` / `.shadow-float` / `.shadow-card`               | Mjuka skuggor                                                             |
| `.no-scrollbar`                                                 | Dölj scrollbar på horizontal scrollers                                    |
| `.scroll-snap-x` / `.scroll-snap-start` / `.scroll-snap-center` | Snap                                                                      |
| `.kenburns`                                                     | Bildzoom på step-slides                                                   |
| `.step-swipe` / `.step-slide`                                   | Fullbredd swipe: bild + sheet                                             |
| `.step-subheader`                                               | Sticky under top-bar: guide + steg + “Steg X av Y” + progress             |
| `.step-nav` / `.step-nav__btn`                                  | Cirkulär prev/next; sista steg = Klart → kategori                         |
| `.menu-drawer`                                                  | Enkel högerpanel från hamburger                                           |

---

## Tillgänglighet

- Min **44×44px** tryckyta på tabs, hamburger, badges, step-nav.
- Skip-länk `.skip-link` → `#main`.
- `aria-label` / `aria-current` / `aria-expanded` på meny och quick-nav.
- Bottom bar: `aria-label="Sidnavigering"`; aktiv tab `is-active`.
- Bilder i listkort: `alt=""` när titeln redan finns i text (dekorativ).

---

## Detaljsida

- **Utan `steps`:** standardartikel (hero, H1, beskrivning) i samma skal.
- **Med `steps` (JSON):** sticky `.step-subheader` + horisontell snap-swipe + cirkulär prev/next. Sista steg **Klart** navigerar till kategori (`/kategori/{slug}/`, fallback `/alla/`).
- **Audio-pod:** opt-in — aktivera i HTML/JS/CSS när appen har ljud; default av i mallen.

Schema-exempel för steps (valfri kolumn i din tabell):

```json
[{ "number": 1, "title": "Steg 1", "description": "…", "image": "https://…" }]
```

---

## Checklista vid ny app

1. Kopiera `templates/public-app/` enligt [`PUBLIC_APP_TEMPLATE.md`](PUBLIC_APP_TEMPLATE.md).
2. Byt `--brand*` och `--font-*` (+ Google Fonts `@import`).
3. Byt copy i TopBar / bottom-tabs / SEO-meta.
4. Behåll klassnamn — tema via tokens, inte nya layoutsystem.
5. Verifiera mobil + smal desktop (phone frame).

---

## Se även

- [`templates/public-app/README.md`](../templates/public-app/README.md)
- [`PUBLIC_APP_TEMPLATE.md`](PUBLIC_APP_TEMPLATE.md)
- [`UI_AND_UX_STANDARDS_V3.md`](UI_AND_UX_STANDARDS_V3.md) — **Homebase admin-UI** (gäller inte denna publika mall)

# Public Cups (Cupappen)

Statisk landningssida med live cupdata från `api/cups.php`. Byggs med vanlig HTML/CSS/JS (`index.html`, `styles.css`, `app.js`).

## Sidstruktur (överkant → fot)

1. **Header** — logotyp, huvudnav: Cuper (`#cup-listing`), För arrangörer (`#organizer`), FAQ (`#faq`).
2. **Hero** — rubrik, lead, filterkort (samma fält som listningen; synkas via JS).
3. **Populära cuper** — `#featured-cups`, utvalda kort (`#featured-cups-grid`).
4. **Arrangörspanel** — `#organizer` (CTA mot info@cupappen.se).
5. **Cupdatabasen** — `#cup-listing`: filter, utvalda-rad (vid filter), brödsmulor, rutnät med alla cuper.
6. **FAQ** — `#faq`, direkt före sidfot.
7. **Footer** — nyhetsbrev + länkar.

Skip-länk: `#cup-listing`.

## Filterkort (layout)

Klasserna `.hero-search-card` och `.filter-card` används i hero och under cup-listan. Gemensamt:

- `max-width: min(100%, 72rem)` så kortet inte blir onödigt brett på stora skärmar.
- `width: 100%` och `margin-inline: auto` så kortet **centreras** i `.container`.
- Från `768px`: rad-layout med `flex-wrap` och `justify-content: center` så rader vid brytning grupperas mot mitten.

Mobil: `#filter-toggle-btn` visar/döljer `#listing-filter-shell` (klass `is-collapsed` sätts i JS).

## API

Se [api/README.md](./api/README.md) för PHP-endpoint, miljövariabler och svarformat.

## Plattformen (admin)

I Homebase-klienten visas **hjältebild** för en cup i läsvyn under övriga cupfält; koppling till fältet `featured_image_url` och översättningsnycklarna `cups.heroImageView` / `cups.heroImageNone` i `client/src/i18n/locales/`.

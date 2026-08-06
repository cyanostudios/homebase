# Public instructions (`public-instructions/`)

Pattern A public app for the Homebase **instructions** plugin (AppShell design mall).

- List/home: Hem | Alla | Info (no Favorites, no audio)
- List: same-origin `/api/items.php` → tenant DB via `APP_DB_URL`
- **URLs:** `/` (startsida), `/alla/`, `/info/`, `/kategori/{slug}/` (kortgrid), `/instruction/{slug}` (guide)
- Frontpage = Netflix-rader per kategori (ordning från `instruction_categories` via `categoryOrder` i `/api/items.php`; JOIN scopa med `user_id`); category page = 2-kolumns kortgrid (utan “Visa alla”)
- Detail: sticky `step-subheader`; circular prev/next; last step “Klart” → category URL; step media height `--step-media-h: 19rem`
- Optional Node companion: `plugins/public-instructions` (list may include `categoryOrder`; not required for local UI)
- **Public residual:** unauthenticated read-only list (`items` + `categoryOrder` name strings) — same class as other public apps; see ADR Security residual

Design tokens: warm coral `--brand` ≈ `#FF6B35`, beige `--bg-page` ≈ `#F7F1EA`.

See [`docs/PUBLIC_APP_TEMPLATE.md`](../docs/PUBLIC_APP_TEMPLATE.md), [`docs/PUBLIC_APP_DESIGN.md`](../docs/PUBLIC_APP_DESIGN.md), and [`docs/ai/adr/INSTRUCTIONS_PLUGIN_ETAPP1.md`](../docs/ai/adr/INSTRUCTIONS_PLUGIN_ETAPP1.md).

## Local run

1. Apply tenant migrations (`npm run migrate:instructions`, includes **117** categories) and publish at least one instruction in Homebase backoffice (`/instructions`). Manage category order under Instructions → Settings → Categories.
2. Set **tenant** connection in `.env.local` (not main `DATABASE_URL`):

```bash
APP_DB_URL=<tenant Neon connection string>
```

3. Start the public app (loads `.env.local`):

```bash
npm run dev:public-instructions
```

4. Open [http://localhost:3010](http://localhost:3010).

Optional CORS for the Node companion: `PUBLIC_INSTRUCTIONS_URL=http://localhost:3010`.

# Frontend bundle analysis (Vite)

Syfte: se **var JavaScript-vikten sitter** i produktionsbygget (moduler, vendor-kod, plugins) utan att ändra normal build.

## Chunk DAG (obligatoriskt)

Produktionsbygget använder `manualChunks` i `vite.config.ts` med en **acyklisk** dependency-ordning. Ömsesidiga imports mellan `vendor-shared` och `app-shell` / `app-context` / `plugin-*` ger ES-modul-TDZ och vit skärm efter deploy.

Se ADR: [`docs/ai/adr/VITE_CHUNK_DAG_TDZ.md`](ai/adr/VITE_CHUNK_DAG_TDZ.md).

```bash
npm run build:ui
```

Kör Vite-produktionbuild och failar vid cirkulär `vendor-shared` ↔ `app-shell` / `app-context` / `plugin-*` (TDZ / vit skärm). Enforcement: Husky **pre-push** + Railway `npm run build`.

Frivilligt ensamt: `npm run check:chunk-cycles` (kräver att `client/dist` redan finns).

## Kommando (storleksanalys)

```bash
npm run build:ui:analyze
```

Sätter `ANALYZE=1` och kör `vite build` med samma config som vanlig UI-build.

## Resultat

- **Fil:** `bundle-stats.html` i **projektroten** (samma nivå som `package.json`).
- **Format:** treemap (`rollup-plugin-visualizer`), med **gzip- och brotli-storlek**.
- **Git:** filen är i `.gitignore` — committa den inte.

## Normal build utan analys

```bash
npm run build:ui
```

Ingen visualizer; marginellt snabbare build.

## Konfiguration

- **Config:** `vite.config.ts` (enda Vite-config; `vite.config.mts` är borttagen).
- **Visualizer:** plugin registreras när `process.env.ANALYZE` är `1` eller `true` (se `rollup-plugin-visualizer` i `vite.config.ts`).

## Tolka rapporten

Öppna `bundle-stats.html` i en webbläsare. Största blocken påverkar **parse/execute** och **nedladdad JS** mest. Jämför med Vites konsolutskrift efter build (chunk-namn och gzip-storlekar).

## Vidare åtgärder

Om huvudchunken är stor: **dynamic `import()`**, justera **`manualChunks`** (utan att bryta DAG-regeln ovan), eller lazy `providerLoader` per plugin (se `PLUGIN_ARCHITECTURE_V3.md`).

# Frontend bundle analysis (Vite)

Syfte: se **var JavaScript-vikten sitter** i produktionsbygget (moduler, vendor-kod, plugins) utan att ändra normal build.

## Kommando

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

Om huvudchunken är stor: **dynamic `import()`**, **`manualChunks`** i `build.rollupOptions.output`, eller lazy `providerLoader` per plugin (se `PLUGIN_ARCHITECTURE_V3.md`).

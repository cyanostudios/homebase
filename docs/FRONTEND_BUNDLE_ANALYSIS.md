# Frontend bundle analysis (Vite)

Syfte: se **var JavaScript-vikten sitter** i produktionsbygget (moduler, vendor-kod, egna plugins) utan att ändra normal build.

## Kommando

```bash
npm run build:ui:analyze
```

Det kör `vite build` med `ANALYZE=1` och genererar en interaktiv rapport.

## Resultat

- **Fil:** `bundle-stats.html` i **projektroten** (samma nivå som `package.json`).
- **Format:** treemap (rollup-plugin-visualizer), med **gzip- och brotli-storlek** i rapporten.
- **Git:** filen är listad i `.gitignore` och ska inte committas.

## Normal build utan analys

```bash
npm run build:ui
```

Ingen visualizer, marginellt snabbare build.

## Konfiguration

- **Vite:** `vite.config.mts` — pluginen `rollup-plugin-visualizer` läggs bara till när miljövariabeln `ANALYZE` är `1` eller `true`.
- **Script:** `build:ui:analyze` i `package.json` sätter `ANALYZE=1` via `cross-env`.

## Tolka rapporten

Öppna `bundle-stats.html` i en webbläsare. Största blocken är de som påverkar **parse/execute** och **nedladdad JS** mest. Jämför gärna med Vites konsolutskrift efter build (chunk-namn och gzip-storlekar).

## Vidare åtgärder

Om huvudchunken är stor pekar Vite ofta på **dynamic `import()`** eller **`manualChunks`** i `build.rollupOptions.output`. Se även `DEVELOPMENT_GUIDE_V2.md` (Performance Optimization → Frontend).

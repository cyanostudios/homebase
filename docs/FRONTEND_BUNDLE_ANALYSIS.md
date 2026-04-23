# Frontend bundle analysis (Vite)

Syfte: se **var JavaScript-vikten sitter** i produktionsbygget (moduler, vendor-kod, egna plugins) utan att ändra normal build.

## Kommando

```bash
npm run build:ui:analyze
```

Det kör `vite build` med `ANALYZE=1`.

## Resultat

- **Fil:** `bundle-stats.html` i **projektroten** (samma nivå som `package.json`).
- **Format:** treemap (rollup-plugin-visualizer), med **gzip- och brotli-storlek** i rapporten.
- **Git:** filen är listad i `.gitignore` och ska inte committas.

## Normal build utan analys

```bash
npm run build:ui
```

Ingen visualizer, marginellt snabbare build.

## Konfiguration (viktig notering)

- **Script:** `build:ui:analyze` i `package.json` sätter `ANALYZE=1` via `cross-env` och kör `vite build`.
- **Aktiv config för `vite build`:** `vite.config.ts`.
- **Visualizer-kod finns idag i:** `vite.config.mts` (gated på `ANALYZE`), vilket innebär att den inte automatiskt används av `vite build` så länge `vite.config.ts` är den aktiva configfilen.

## Nuvarande rekommenderade körning

Om du vill vara säker på att visualizer används i nuvarande setup, kör:

```bash
cross-env ANALYZE=1 vite build --config vite.config.mts
```

Alternativt: flytta visualizer-blocket till `vite.config.ts` för att `npm run build:ui:analyze` ska fungera utan extra flagga.

## Tolka rapporten

Öppna `bundle-stats.html` i en webbläsare. Största blocken är de som påverkar **parse/execute** och **nedladdad JS** mest. Jämför gärna med Vites konsolutskrift efter build (chunk-namn och gzip-storlekar).

## Vidare åtgärder

Om huvudchunken är stor pekar Vite ofta på **dynamic `import()`** eller **`manualChunks`** i `build.rollupOptions.output`. Se även `DEVELOPMENT_GUIDE_V2.md` (Performance Optimization → Frontend).

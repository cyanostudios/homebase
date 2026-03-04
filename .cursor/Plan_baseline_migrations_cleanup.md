# Plan: Baseline + städning av migrations (KÖR EJ NU)

## Mål

Skapa en ren och säker migreringskedja där:

- Baseline speglar **faktiskt live-schema i Neon**.
- Förlegade migrations inte längre behöver köras i ordinarie pipeline.
- Risken för schema-regression minimeras med verifiering innan någon cutover.

## Viktig princip

Historiska migrations är **inte** facit.  
Facit är nuvarande schema i Neon (tenant-scheman).

## Scope (framtida arbete)

- Inkluderar: schema-inventering, baseline-bygg, testvalidering, migreringsstädning.
- Exkluderar: omedelbar deploy/cutover i produktion (tas i separat beslut efter validering).

## Fas 0 - Förberedelser (read-only)

1. Lås process:
   - Inga schemaändringar under inventeringsfönstret.
   - Tidsfönster dokumenteras.
2. Definiera source-of-truth:
   - Neon project: `wandering-snow-54010771`.
   - Tenant-scheman: `tenant_1`, `tenant_2`, `tenant_3` (eller aktuella vid körning).
3. Dokumentera appversion/commit hash för spårbarhet.

## Fas 1 - Inventering av verkligt schema

1. Ta schema-export per tenant (tabeller, kolumner, typer, default, constraints, index).
2. Jämför tenant-scheman:
   - Identifiera avvikelser mellan tenants.
   - Klassificera: avsiktlig skillnad vs drift.
3. Generera inventeringsrapport:
   - "Canonical candidate" schema.
   - Lista med avvikelser som måste beslutas.

## Fas 2 - Koddriven validering mot schema

1. Sök igenom backend SQL-anrop:
   - Tabeller/kolumner som appen faktiskt använder.
2. Matcha mot canonical candidate:
   - Saknad kolumn/tabell i candidate -> blocker.
   - Oanvänt legacy-objekt -> kandidat för borttag/arkiv.
3. Skapa "required by code"-lista som måste finnas i baseline.

## Fas 3 - Bygg baseline-migration (ny startpunkt)

1. Skapa ny baseline-fil (ex: `100-baseline.sql`) som beskriver canonical schema.
2. Baseline ska innehålla:
   - CREATE TABLE/INDEX/CONSTRAINT/DEFAULT för allt required.
   - Inga legacy-fallbacks.
3. Lägg till "post-baseline" delta-filer endast för ändringar efter baseline.

## Fas 4 - Verifiering i ren testdatabas

1. Provisionera tom test-DB/scheman.
2. Kör endast:
   - baseline
   - post-baseline migrations
3. Kör schema-diff:
   - Test-DB vs Neon canonical.
   - Diff måste vara tom eller explicit godkänd.
4. Kör app-smoke:
   - Start av API, grundläggande CRUD, kanalinstanser, orderflöden.

## Fas 5 - Arkiveringsplan för gamla migrations

1. Dela upp gamla migrations i grupper:
   - `obsolete` (ersatta av baseline)
   - `keep-for-reference` (dokumentation)
2. Uppdatera migreringsrunner:
   - Kör baseline + post-baseline i normal pipeline.
   - Kör inte obsolete-filer.
3. Behåll historik i repo (arkiverad), men ej exekverad.

## Fas 6 - Cutover (senare separat beslut)

1. Godkänn checklista från Fas 4.
2. Planera deploymentfönster.
3. Kör ny migreringskedja i staging -> produktion.
4. Efterkontroll med schema-diff + applogg.

## Acceptance criteria

- Baseline kan sätta upp tom DB till fungerande schema utan äldre filer.
- Schema-diff mot canonical Neon är tom/godkänd.
- Inga blockerande SQL-fel i appens huvudflöden.
- Migreringspipeline kör utan legacy-migrationer.

## Risker och skydd

- Risk: dolda tenant-skillnader.
  - Skydd: per-tenant inventering + explicit beslut för varje drift.
- Risk: kod använder "glömd" kolumn.
  - Skydd: kodsökning + smoke-test efter baseline.
- Risk: oavsiktlig dataförlust vid cleanup.
  - Skydd: ingen drop i första cut; endast arkivera körkedja först.

## Konkreta leverabler (TODO)

1. `docs/DB-BASELINE-INVENTORY.md` - inventeringsrapport.
2. `server/migrations/100-baseline.sql` - baseline.
3. `server/migrations/101+` - post-baseline deltas.
4. `docs/DB-MIGRATION-CUTOVER-CHECKLIST.md` - cutover/checklista.
5. Uppdaterad `scripts/run-all-migrations.js` strategi för baseline-läge.

## Beslut som måste tas innan start

1. Ska baseline byggas per tenant eller gemensam canonical med pre-sync steg?
2. Ska vi tillåta automatiskt normaliseringssteg för tenant-drifter före baseline?
3. När ska cutover-fönster läggas (efter Sello-import eller före)?

---

Status: **Planerad (ej påbörjad)**  
Instruktion: **Kör inte stegen nu.**

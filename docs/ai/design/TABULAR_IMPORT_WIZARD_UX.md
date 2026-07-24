# Design Package — Tabular Import Wizard (v1)

**Status:** Grind 3 design; v1 implementerad och grindad (QA + Security + Docs) 2026-07-23. **Ej prod-release.**  
**Datum:** 2026-07-23  
**ADR:** [`docs/ai/adr/TABULAR_IMPORT_EXPORT.md`](../adr/TABULAR_IMPORT_EXPORT.md)  
**Yta:** `ImportWizard` (core) + settings-copy i contacts/notes/tasks

---

## Användarmål

Användaren ska kunna föra in tabellär data (fil eller urklipp) till ett plugin (t.ex. contacts) med tydlig mappning, förhandsgranskning och resultat — utan att lämna settings-flödet.

---

## Användarflöde

```text
Settings → Import → [Öppna Import]
  → Steg 1 Source: välj Fil ELLER Klistra in
  → (validering: tomt / för stort / ogiltigt format)
  → Steg 2 Mapping: kolumn → fält (oförändrat mönster)
  → Steg 3 Preview: första 5 rader
  → Start Import
  → Steg 4 Result: lyckade / misslyckade → Done (stänger)
```

**Varför fyra steg:** Resultat får inte försvinna i en auto-stängning när partial failure är normalt (ADR).

### Steg 1 — Source (ersätter enbart “upload”)

**Layout (vertikal i dialog `max-w-2xl`):**

1. **Segment / två kort i samma kolumn** (inte tabs som gömmer alternativ):
   - **Upload file** — primär dropzone (befintlig dashed border-yta)
   - **Paste data** — sekundär sektion under, eller toggle mellan två paneler via två knappar i en rad (`Upload` | `Paste`) där aktiv panel visas

**Vald variant:** En rad med två `Button variant="secondary"` / aktiv `variant="primary"` (eller outline + filled): **File** | **Paste**. En panel i taget — enklare på mobil, återanvänder dialoghöjd.

#### Panel A — File

- Dashed dropzone (befintlig stil)
- Rubrik: “Select a file”
- Hjälptext: “CSV or Excel (.xlsx). First sheet only for Excel.”
- Knapp: “Select file” (`accept=".csv,.xlsx"`)
- **Drag-and-drop:** ska fungera (copy lovar det idag — implementera; annars ta bort “drag and drop” från copy)
- Efter val: visa filnamn + “Continue” **eller** auto-gå till Mapping när parse lyckas (nuvarande beteende: auto till mapping). **Behåll auto-advance** vid lyckad parse för parity.

#### Panel B — Paste

- `Textarea` (befintlig `@/components/ui/textarea`), min-höjd ~160px
- Placeholder: “Paste rows with a header line. Tab or comma separated.”
- Primärknapp under: **Continue** (disabled om tom/whitespace)
- Vid Continue: parse → Mapping (samma auto-mapping som fil)
- Källetikett i Mapping-info: “Pasted data” istället för filnamn

### Steg 2–3 — Mapping & Preview

Oförändrad layout och komponenter (`NativeSelect`, `ScrollArea`, preview-tabell). Enda copy-uppdateringar:

- Mapping-info: “N rows detected…”
- Om required-fält saknar mappning: disable **Next: Preview** + kort inline-text “Map all required fields”

### Steg 4 — Result (nytt)

Efter `onImport` returnerar (plugin bör returnera `{ successCount, failureCount }` — se genomförbarhet):

- Ikon + rubrik: “Import finished”
- Text: “{success} imported. {failure} failed.” (dölj failure-rad om 0)
- En knapp: **Done** → stäng dialog och reset state
- **Stäng inte automatiskt** vid success (användaren ska hinna läsa)

Om hela importen kastar (oväntat fel): behåll preview-steg, visa felrad ovanför footer: “Import could not be completed. Try again.”

### Soft limits (ADR)

Vid överskriden gräns (Frontend sätter konkreta tal enligt ADR soft limit):

- Stanna på Source
- Inline error under panel: “File is too large” / “Too many rows (max N)”
- Ingen navigering till Mapping

### Settings-yta (contacts m.fl.)

Uppdatera beskrivning under Import:

- EN: “Import from CSV, Excel (.xlsx), or pasted table. Map columns, preview, then import.”
- SV: motsvarande
- Behåll en knapp som öppnar wizard (ingen ny navigation)

---

## Wireframe (text)

```
┌─────────────────────────────────────────────┐
│ Import contacts                    [SOURCE] │
├─────────────────────────────────────────────┤
│  [ File ]  [ Paste ]     ← File aktiv       │
│                                             │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐   │
│  │         ↑ Upload icon                 │   │
│  │    Select a file                      │   │
│  │    CSV or Excel (.xlsx)…              │   │
│  │         [ Select file ]               │   │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘   │
│                                             │
│                         [ Cancel ]          │
└─────────────────────────────────────────────┘

Paste aktiv:
│  [ File ]  [ Paste ]                        │
│  ┌─────────────────────────────────────┐    │
│  │ (textarea)                          │    │
│  └─────────────────────────────────────┘    │
│              [ Cancel ]  [ Continue ]       │

Result:
│  ✓ Import finished                          │
│  42 imported. 3 failed.                     │
│                         [ Done ]            │
```

---

## Komponentspecifikation

| Element         | Komponent / mönster                                                                          |
| --------------- | -------------------------------------------------------------------------------------------- |
| Dialog          | Befintlig `AlertDialog` + `AlertDialogContent max-w-2xl`                                     |
| Steg-badge      | Befintlig `Badge variant="outline"` — värden: `source` \| `mapping` \| `preview` \| `result` |
| Source-toggle   | Två `Button` i rad (`size="sm"`), aktiv tydlig                                               |
| Dropzone        | Befintlig dashed `border-2 rounded-xl`                                                       |
| Paste           | `Textarea` från designsystem                                                                 |
| Mapping/preview | Oförändrat                                                                                   |
| Result CTA      | `Button` primary “Done”                                                                      |
| Fel / limit     | Kort text `text-sm text-destructive` under panel (inga nya toast-krav i v1)                  |

**Nya visuella mönster:** inga. Inga cards-i-cards utöver befintlig dashed zone och info-banner.

**i18n:** Alla nya strängar via i18n (en/sv); undvik hardcodad engelsk copy i wizard (idag delvis hårdkodad — förbättringsflagga till TPM).

---

## Tillgänglighet och responsivitet

- Source-toggle: tydlig selected-state (inte bara färg); `aria-pressed` på toggle-knappar
- File input: behåll synlig “Select file”-knapp (inte enbart dropzone-klick)
- Textarea: label synlig (“Paste data”) kopplad via `htmlFor`
- Fokusordning: toggle → panelkontroll → Cancel / Continue
- Mobil: en kolumn; mapping redan `flex-col sm:flex-row` — behåll
- Preview-tabell: horisontell scroll via `ScrollArea` (befintligt)
- Färg: required-badge och feltext får inte vara enda signal (text + badge)

---

## Teknisk genomförbarhet (ADR)

Avstämt med ADR:

- Multi-source i wizard: ja
- Resultatsummering: ja (partial success)
- Soft limits: ja
- Första Excel-sheet only: speglas i hjälptext

**Öppet för Frontend (inte UX-block):** konkret `onImport`-returtyp `{ successCount, failureCount }` — ADR kräver summering; plugins som returnerar `void` behöver uppdateras (contacts först).

---

## Angränsande förbättringar (utanför scope)

- Hardkodad engelsk copy i hela `ImportWizard` → i18n (flaggat)
- Drag-and-drop copy utan implementation → åtgärda i samma epic
- Notes/tasks settings-beskrivning samma copy-uppdatering (låg kostnad, rekommenderas i samma PR)

---

## Överlämning

Till **Frontend Developer**: implementera enligt denna design + ADR; contacts som referens för result-callback.

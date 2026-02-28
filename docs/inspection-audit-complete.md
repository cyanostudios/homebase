# Inspection Plugin – Fullständig audit

## 1. INSPECTION ENDPOINTS (servern)

| Endpoint | Metod | Vid success (200/201) | Vid fel |
|----------|-------|------------------------|---------|
| GET /api/inspection/projects | getAll | Array (rows.map) – aldrig null | 500 JSON {error} |
| GET /api/inspection/projects/:id | getById | Objekt eller 404 {error} | 404, 500 |
| POST /api/inspection/projects | create | 201 Objekt (getById) | 400 val, 500 |
| PUT /api/inspection/projects/:id | update | Objekt (getById) | 404, 500 |
| DELETE /api/inspection/projects/:id | delete | 204 (no body) | 404, 500 |
| POST /api/inspection/projects/batch-delete | bulkDelete | {ok, deletedCount, deletedIds} | 400, 500 |
| POST /api/inspection/projects/:id/files | addFiles | Objekt (getById) | 400, 404, 500 |
| PUT /api/inspection/projects/:id/files | setFiles | Objekt (getById) | 400, 404, 500 |
| DELETE /api/inspection/projects/:id/files/:fileId | removeFile | Objekt (getById) | 500 |
| POST /api/inspection/projects/:id/file-lists | addFileList | 201 Objekt | 400, 404, 500 |
| DELETE /api/inspection/projects/:id/file-lists/:fileListId | removeFileList | Objekt | 404, 500 |
| POST /api/inspection/projects/:id/send | send | {ok, message, logEntry} | 400, 404, 500 |
| GET /api/inspection/projects/:id/send-history | getSendHistory | Array (rows.map) | 404, 500 |

### getAll-svar
- `files`: alltid `[]`
- `fileCount`: number
- `fileLists`: saknas (undefined)

### getById-svar
- `files`: array (getProjectFiles rows.map)
- `fileCount`: number
- `fileLists`: array (getProjectFileLists)

---

## 2. BEROENDE-ENDPOINTS (files, contacts, lists, mail)

| Endpoint | Klientanrop | Success-svar | Vid fel |
|----------|-------------|--------------|---------|
| GET /api/files | filesApi.getItems() | Array (rows.map) | 500 throw |
| GET /api/files/lists | filesApi.getLists() | Array (listsModel) | 500 throw |
| GET /api/files/lists/:id/files | filesApi.getListFiles() | Array (filesModel.getListFiles) | 404, 500 throw |
| GET /api/contacts | fetch | Array (model.getAll) | 500 |
| GET /api/contacts/lists | contactsApi.getLists() | Array | 500 throw |
| GET /api/contacts/lists/:id/contacts | contactsApi.getListContacts() | Array | 500 throw |

### listsModel.getLists
- Returnerar `(rows || []).map(...)` – servern har fallback, alltid array.

### mail getHistory
- Returnerar `[]` om !userId, annars `rows.map(...)` – alltid array.

---

## 3. KLIENT-API-BETEEENDE

**inspectionApi.request():**
- Vid `!response.ok` → throw (ingen JSON-parse)
- Vid 204 → return undefined
- Vid 200/201 → return response.json()

**Resultat:** Vid fel når vi aldrig `setState` med felaktig data – vi får throw och hamnar i catch.

**Risk:** Om servern svarar 200 med `null` i body (bugg) → `response.json()` blir null → vi sätter null i state → krasch vid .map/.filter.

---

## 4. INTAKE-FLÖDE

- POST /api/intake/inspection-request (webhook, ingen klient)
- Använder InspectionModel.create + addFiles
- Skapar samma struktur som manuell create
- Klienten laddar via GET /api/inspection/projects eller getById
- Samma API, samma svarsformat

---

## 5. KRASCHRISKER I KLIENTEN

### InspectionContext
- `setInspectionProjects(data)` – om data är null → inspectionProjects blir null → InspectionList filtered.map kraschar.
- **Orsak:** getProjects returnerar aldrig null enligt servern, men om det händer kraschar vi.

### InspectionList
- `inspectionProjects` från context – om null/undefined kraschar filter/map.
- `project.fileCount` – kan vara undefined för projekt från getAll om servern ändras. Typen har fileCount?, så det kan bli undefined.

### FilePicker
- `setFiles(data)` – om getItems() returnerar null ( ska inte ske) → files är null → files.filter kraschar.

### ListPicker
- `setLists(data)` – samma risk för getLists().

### ContactListPicker
- `setLists(data)`, `setListContacts` – samma risk.

### SendModal
- `project.fileLists!` – assertion. Om project kommer från listan (utan fileLists) kraschar vi.
- **Flöde:** SendModal öppnas från InspectionView när vi redan har laddat fullt projekt via getProject. Då har project fileLists. Men om vi öppnar Send innan getProject är klar? InspectionView använder projectToSend som är currentProject – som sätts när vi laddar. Vi öppnar Send från edit-vy, så vi borde ha fullt projekt.

### InspectionView
- `projectFileLists` kan vara undefined (getAll skickar inte fileLists).
- `projectFileLists?.length` – vi använder optional chaining i en useEffect.
- `projectFileLists!.map` i ListPicker selectedIds – när projectFileLists är undefined (edit från list, innan load) kraschar vi. Vi har guard: `projectFileLists === undefined && !isCreate` visar "Laddar listor..." istället för ListPicker. Men när vi väl visar ListPicker använder vi `projectFileLists!.map` – då måste projectFileLists vara definierad. När visar vi ListPicker? När showListPicker är true. När sätter vi det? När användaren klickar "Lägg till listor". I create-läge har vi projectFileLists = [] ( från else-branch). I edit-läge har vi projectFileLists från getProject – som kan vara undefined tills getProject svarar. Så användaren kan klicka "Lägg till listor" innan getProject svarar. Då är projectFileLists undefined. Vi har guard: `projectFileLists === undefined && !isCreate` – då visar vi "Laddar listor...". Så vi visar INTE ListPicker när projectFileLists är undefined. Bra. Men selectedIds={... projectFileLists!.map(...)} – vi når den koden bara när vi INTE visar "Laddar listor...", dvs när projectFileLists !== undefined || isCreate. Om isCreate använder vi pendingListIds. Om !isCreate och projectFileLists !== undefined använder vi projectFileLists.map. Så vi är safe.

---

## 6. SERVERN KAN ALDRIG RETURNERA NULL FÖR ARRAY-ENDPOINTS

- getAll: rows.map → array
- getById: returnerar objekt eller 404 (res.status(404).json)
- getHistory: rows.map eller return [] → array
- getLists: (rows || []).map → array
- contacts getAll: rows.map → array
- files getAll: rows.map → array

**Slutsats:** Servern returnerar inte null för lista-endpoints vid 200. Vi är safe om servern följer detta.

---

## 7. ÅTGÄRDER SOM BEHÖVS

1. **Inga fler fallbacks** – vi har tagit bort dem. Om servern returnerar fel data ska vi krascha (för att syna buggen).
2. **Felhantering** – alla API-anrop har try/catch. Vid throw sätter vi validationErrors eller error state. Vi kraschar inte i catch.
3. **Typkontroll** – InspectionProject har fileCount?, fileLists? – matchar getAll vs getById.

### Åtgärd: SendModal-krasch

**Problem:** I edit-läge kunde användaren klicka "Skicka" innan `projectFileLists` laddats från getProject. `projectToSend` fick då `fileLists: undefined`, vilket gav krasch i SendModal på `project.fileLists!.map(...)`.

**Åtgärd:** Knappen "Skicka" är disabled tills `projectFileLists !== undefined` i edit-läge. Inget fallback – vi öppnar inte modal förrän data finns.

---

## 8. STATUS

- Dokumentation: klar (`inspection-api-responses.md`, `inspection-audit-complete.md`)
- Fallbacks borttagna: ja
- Kraschrisker: SendModal fixad (disabled tills fileLists laddad); övriga teoretiska (servern returnerar aldrig null)
- Intake: använder samma model, samma struktur
- Explicit hantering av undefined: projectFileLists, fileLists från getAll, disabled "Skicka" tills laddat

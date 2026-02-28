# Inspection API – exakt vad servern returnerar

Detta dokument beskriver vad servern **faktiskt** returnerar för varje endpoint som Inspection-klienten använder. Klientkoden ska följa detta – inga fallbacks.

---

## Inspection-endpoints

### GET /api/inspection/projects (getAll)

**Model:** `inspection/model.js` → `getAll()` → `transformProject(row, file_count)`

**Returnerar:** `Array<InspectionProjectListItem>`

Varje objekt:
- `id`: string
- `name`: string (från DB, kan vara null → `?? ''`)
- `description`: string (från DB, kan vara null → `?? ''`)
- `adminNotes`: string
- `createdAt`, `updatedAt`: string
- **`files`**: **alltid `[]`** (tom array – listan laddar inte filer)
- **`fileCount`**: **number** (från SQL COUNT)
- **`fileLists`**: **saknas** (fältet finns inte i svaret)

---

### GET /api/inspection/projects/:id (getById)

**Model:** `getById()` → `transformProject()` + `getProjectFiles()` + `getProjectFileLists()`

**Returnerar:** `InspectionProject | null` (404 om inte finns)

Objekt:
- `id`, `name`, `description`, `adminNotes`, `createdAt`, `updatedAt`: string
- **`files`**: **alltid array** (tom eller med filer) – från `getProjectFiles()` som använder `rows.map()`
- **`fileCount`**: **number** (`project.files.length`)
- **`fileLists`**: **alltid array** (tom eller med listor) – från `getProjectFileLists()` som bygger `result = []` och pushar

---

### GET /api/inspection/projects/:id/send-history

**Model:** `mail/model.js` → `getHistory()`

**Returnerar:** `Array<SendHistoryEntry>` – `rows.map()` ger alltid en array

---

## Endpoints som Inspection använder via andra API:er

### GET /api/files (filesApi.getItems)

**Model:** `files/model.js` → `getAll()` → `rows.map()`

**Returnerar:** alltid `Array` (tom eller med filer)

---

### GET /api/files/lists (filesApi.getLists)

**Model:** `listsModel.getLists(req, 'files')` → `(rows || []).map()`

**Returnerar:** alltid array (servern har `rows || []` internt)

---

### GET /api/contacts/lists (contactsApi.getLists)

**Model:** `listsModel.getLists(req, 'contacts')`  
**Returnerar:** alltid array

---

### GET /api/contacts (fetch i SendModal)

**Returnerar:** alltid array (contacts model getAll)

---

## Slutsats

| Fält / Response | getAll | getById | Övriga |
|-----------------|--------|---------|--------|
| `files` | `[]` | `[]` eller full | – |
| `fileLists` | **saknas** | array | – |
| `fileCount` | number | number | – |
| projects-array | array | – | – |
| send-history | – | – | array |
| files/getItems | – | – | array |
| getLists | – | – | array |

**Regel:** Servern returnerar aldrig `null` för arrayer. Vid tom lista skickas `[]`.  
**Undantag:** `getAll` inkluderar inte `fileLists` – fältet är `undefined` i listvy.

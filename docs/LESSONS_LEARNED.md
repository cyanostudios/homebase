# Lessons Learned

**Syfte**: Dokumentera misstag och lärdomar för att undvika att upprepa dem.  
**Format**: ❌ What we did (that didn't work) → ✅ What we do instead (that works) → 💡 Why (lesson learned)

---

## Database SDK

### query() returnerar rows direkt, inte {rows: [...]}

❌ **What we did (that didn't work):**

```javascript
// Antog att SDK fungerar som pool.query()
const result = await db.query('SELECT * FROM notes', []);
return result.rows.map(this.transformRow); // ❌ result.rows är undefined!
```

✅ **What we do instead (that works):**

```javascript
// SDK returnerar rows direkt
const rows = await db.query('SELECT * FROM notes', []);
return rows.map(this.transformRow);
```

💡 **Why (lesson learned):**
SDK:er kan ha helt annorlunda API än det man är van vid. Läs SDK-implementationen FÖRST - `packages/core/src/Database.js` visar exakt vad som returneras. Antaganden baserade på "så brukar det vara" leder till buggar.

---

### Använde ServiceManager direkt i plugins

❌ **What we did (that didn't work):**

```javascript
// ServiceManager är inte tillgänglig i plugin context
const database = ServiceManager.get('database', req);
const logger = ServiceManager.get('logger');
```

✅ **What we do instead (that works):**

```javascript
// Använd SDK som är designad för plugins
const { Logger, Database } = require('@homebase/core');
const db = Database.get(req);
Logger.info('Message', { data });
```

💡 **Why (lesson learned):**
Plugins ska använda SDK, inte core-tjänster direkt. ServiceManager är en intern implementation detail som kan ändras. SDK:er finns för att ge plugins en stabil, abstraherad interface. Om något fungerar i core-kod betyder det INTE att det fungerar i plugins - plugins har isolerad context.

---

### Skickade context som parameter trots att det redan fanns inbyggt

❌ **What we did (that didn't work):**

```javascript
// Trodde att context måste skickas manuellt
const db = Database.get(req);
const context = this._getContext(req); // Onödig!
const rows = await db.query('SELECT * FROM notes', [], context); // context ignoreras
```

✅ **What we do instead (that works):**

```javascript
// Context är redan inbyggt i Database.get(req)
const db = Database.get(req);
const rows = await db.query('SELECT * FROM notes', []); // Context hanteras automatiskt
```

💡 **Why (lesson learned):**
SDK:er abstraherar bort komplexitet - om SDK kräver något, kommer det att vara tydligt. Extra parametrar som ignoreras är ett tecken på att man missförstått API:et. Om du skapar helper-metoder som SDK redan hanterar, är det ett tecken på att du inte förstått SDK:ns design. Läs implementationen.

---

### Antog att insert() returnerar samma format som query()

❌ **What we did (that didn't work):**

```javascript
// Antog att insert returnerar { rows: [...] }
const result = await db.insert('notes', data);
return this.transformRow(result.rows[0]); // ❌ result.rows finns inte
```

✅ **What we do instead (that works):**

```javascript
// insert() returnerar record direkt
const record = await db.insert('notes', data);
return this.transformRow(record);
```

💡 **Why (lesson learned):**
Varje metod kan ha olika return-format - läs dokumentationen för varje metod. Convenience-metoder (insert, update) returnerar ofta data direkt, inte wrappat. Anta inte att metoder har samma format bara för att de är i samma SDK.

---

### existing.rows.length vs existing.length

❌ **What we did (that didn't work):**

```javascript
// Antog att db.query() returnerar {rows: [...]} format
const existing = await db.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
if (existing.rows.length === 0) {
  // ❌ existing.rows är undefined
  throw new AppError('Task not found', 404);
}
```

✅ **What we do instead (that works):**

```javascript
// db.query() returnerar rows-array direkt
const existing = await db.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
if (!existing || existing.length === 0) {
  throw new AppError('Task not found', 404);
}
```

💡 **Why (lesson learned):**
PostgreSQLAdapter.query() returnerar `result.rows` direkt (en array), inte ett objekt med `.rows` property. Läs SDK-implementationen i `server/core/services/database/adapters/PostgreSQLAdapter.js` för att se exakt vad som returneras.

---

### "User context required for update" - userId saknas

❌ **What we did (that didn't work):**

```javascript
// Database.get(req) använde bara req.session?.user?.id
const context = {
  pool,
  userId: req.session?.user?.id, // Saknar currentTenantUserId!
};
```

✅ **What we do instead (that works):**

```javascript
// Använd både currentTenantUserId och user.id
const context = {
  pool,
  userId: req.session?.currentTenantUserId || req.session?.user?.id,
};
```

💡 **Why (lesson learned):**
PostgreSQLAdapter.\_getContext() använder `req.session?.currentTenantUserId || req.session?.user?.id`. Database.get(req) måste matcha detta för att userId ska sättas korrekt i contexten som db.update() kräver.

---

## Layout & UI

### Följ befintliga patterns strikt

❌ **What we did (that didn't work):**
Skapade settings routes med nytt pattern som inte matchade auth.js eller admin.js.

✅ **What we do instead (that works):**

```javascript
// ✅ KORREKT - Följer samma pattern som auth.js
function setupSettingsRoutes(mainPool, authMiddleware) {
  pool = mainPool;
  requireAuth = authMiddleware;
}

// ✅ KORREKT - JSONB för flexibla settings-strukturer
CREATE TABLE user_settings (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category VARCHAR(100) NOT NULL,
  settings JSONB NOT NULL DEFAULT '{}',
  UNIQUE(user_id, category)
);
```

💡 **Why (lesson learned):**
När du lägger till nya core routes, följ EXAKT samma pattern som befintliga routes (dependency injection, error handling, logging). Konsistens gör koden lättare att förstå och underhålla.

---

### NavPage type måste uppdateras överallt

❌ **What we did (that didn't work):**
Lade till 'settings' i rendering men glömde uppdatera NavPage type.

✅ **What we do instead (that works):**

```typescript
// ✅ KORREKT - Uppdatera NavPage type
export type NavPage = 'contacts' | 'notes' | 'estimates' | 'invoices' | 'tasks' | 'files' | 'settings';

// ✅ KORREKT - Hantera settings separat i App.tsx
{currentPage === 'settings' ? (
  <SettingsList onCategoryClick={(categoryId) => {...}} />
) : (
  renderers.renderCurrentPage(currentPage, PLUGIN_REGISTRY)
)}
```

💡 **Why (lesson learned):**
Settings är en core-funktion, inte ett plugin. Behandla det som en special case i routing. När du lägger till nya pages, uppdatera ALLA ställen där NavPage type används.

---

### Separata UniversalPanels för olika syften

❌ **What we did (that didn't work):**
Försökte återanvända samma panel-state för både plugins och settings.

✅ **What we do instead (that works):**

```tsx
// ✅ KORREKT - Separata paneler för olika syften
<UniversalPanel isOpen={isAnyPanelOpen} {...pluginProps}>
  {renderers.renderPanelContent()}
</UniversalPanel>

<UniversalPanel isOpen={isSettingsPanelOpen} {...settingsProps}>
  {settingsCategory === 'profile' && <ProfileSettingsForm />}
</UniversalPanel>
```

💡 **Why (lesson learned):**
Plugins och settings har olika panel-state-hantering. Settings-kategorier behöver separat state (settingsCategory). Förhindrar konflikter mellan plugin-paneler och settings-paneler. Försök INTE att återanvända samma panel-state för både plugins och settings - det leder till state-konflikter.

---

### API-metoder i AppContext behöver både interface och implementation

❌ **What we did (that didn't work):**
Lade till metoder i interface men glömde implementation, eller vice versa.

✅ **What we do instead (that works):**

```typescript
// 1. Interface
interface AppContextType {
  getSettings: (category?: string) => Promise<any>;
  updateSettings: (category: string, settings: any) => Promise<any>;
}

// 2. API object
const api = {
  async getSettings(category?: string) {
    return this.request(category ? `/settings/${category}` : '/settings');
  },
};

// 3. Provider wrapper
const getSettings = async (category?: string) => {
  try {
    const response = await api.getSettings(category);
    return response.settings;
  } catch (error) {
    console.error('Failed to fetch settings:', error);
    return {};
  }
};

// 4. Provider value
<AppContext.Provider value={{ ...otherProps, getSettings, updateSettings }}>
```

💡 **Why (lesson learned):**
Alla fyra steg krävs för att AppContext ska fungera korrekt. Glöm INTE något av dessa steg - alla fyra krävs: interface, API object, Provider wrapper, och Provider value.

---

### Forms behöver inte alltid full Context-arkitektur

❌ **What we did (that didn't work):**
Skapade SettingsContext för enkla load/save operations.

✅ **What we do instead (that works):**

```typescript
// ✅ Enkelt - använd AppContext direkt
const { getSettings, updateSettings } = useApp();

const handleSave = async () => {
  await updateSettings('preferences', formData);
};
```

💡 **Why (lesson learned):**
Plugins har full Context (Provider, hook, state management) eftersom de hanterar komplex CRUD. Settings är enklare - bara load/save operations. Settings-forms kan använda AppContext direkt istället för egen Context. Överdriv inte arkitekturen. Om något är enkelt, håll det enkelt. Contexts är för komplex state-hantering.

---

## API & Context

### saveTask måste acceptera explicit taskId för quick actions

❌ **What we did (that didn't work):**

```typescript
// Quick actions i TaskView anropade saveTask utan taskId
const success = await saveTask(updatedData); // Använder currentTask.id
// Men task prop i TaskView kanske inte matchar currentTask i context
```

✅ **What we do instead (that works):**

```typescript
// saveTask accepterar valfritt taskId som andra parameter
const saveTask = async (taskData: any, taskId?: string): Promise<boolean> => {
  const idToUpdate = taskId || currentTask?.id || taskData.id;
  // ...
};

// Quick actions skickar explicit task.id
const success = await saveTask(updatedData, task.id);
```

💡 **Why (lesson learned):**
När quick actions anropas från TaskView, används `task` prop. Men `saveTask` använder `currentTask.id` från context, vilket kanske inte matchar `task` prop. Genom att acceptera explicit `taskId` kan quick actions fungera oavsett om `currentTask` är uppdaterad eller inte.

---

### Tasks plugin uppdateringar gav 500 trots korrekt data

❌ **What we did (that didn't work):**
Vi försökte uppdatera status/priority men backend svarade 500. Det visade sig att plugins inte laddades (saknade `@homebase/core` dependency) och quick actions skickade inte tydligt `taskId`.

✅ **What we do instead (that works):**

- Se till att `@homebase/core` finns som lokal dependency i root `package.json`.
- Starta båda servrarna med `npm run dev:all` så API (3002) och UI (3001) kör samtidigt.
- Skicka alltid explicit `taskId` vid quick actions.

💡 **Why (lesson learned):**
Om backend inte laddar plugins korrekt får du 500 även om frontend‑koden är rätt. Quick actions behöver alltid vara deterministiska med ID, annars uppdateras fel item eller inget alls.

---

### Priority och status quick actions behöver korrekt task ID

❌ **What we did (that didn't work):**

```typescript
// handlePriorityChange anropade saveTask utan explicit task ID
const success = await saveTask(updatedData);
// Om currentTask inte matchar task prop, uppdaterar fel task
```

✅ **What we do instead (that works):**

```typescript
// Skicka explicit task.id när quick actions anropas
const handlePriorityChange = async (newPriority: string) => {
  const updatedData = {
    title: task.title,
    content: task.content,
    mentions: task.mentions,
    status: task.status,
    priority: newPriority,
    dueDate: task.dueDate,
    assignedTo: task.assignedTo,
  };

  const success = await saveTask(updatedData, task.id); // ✅ Explicit ID
};
```

💡 **Why (lesson learned):**
Quick actions i TaskView använder `task` prop direkt. För att säkerställa att rätt task uppdateras, måste `task.id` skickas explicit till `saveTask`, oavsett om `currentTask` i context är uppdaterad eller inte.

---

## Database & Setup

### npm run dev startar BARA backend per default

❌ **What we did (that didn't work):**
Körde `npm run dev` och trodde att både backend och frontend skulle starta.

✅ **What we do instead (that works):**

```bash
# Antingen separata terminals:
npm run dev:api  # Backend (port 3002)
npm run dev:ui   # Frontend (port 3001)

# Eller allt i en terminal:
npm run dev:all  # Båda samtidigt med concurrently
```

💡 **Why (lesson learned):**
`npm run dev` kör bara `dev:api`, inte frontend. Frontend måste startas separat med `npm run dev:ui`, eller använd `npm run dev:all` för båda. Läs package.json scripts innan du startar servrar.

---

### Nya tabeller kräver att setup-database.js körs

❌ **What we did (that didn't work):**
Lade till `user_settings`-tabellen i `scripts/setup-database.js` men körde INTE scriptet.

✅ **What we do instead (that works):**

```bash
# Kör setup-database.js för att skapa alla tabeller
node scripts/setup-database.js

# Verifiera att tabellen skapades
psql $DATABASE_URL -c "\dt" | grep user_settings
```

💡 **Why (lesson learned):**
När du lägger till nya tabeller i setup-database.js, måste du **ALLTID** köra scriptet för att uppdatera databasen. Bara att ändra koden räcker inte! Om du ser "relation does not exist" fel → tabellen finns inte i databasen. Kör setup-database.js för att skapa den.

---

### AUTH-databas vs TENANT-databas - viktigt!

❌ **What we did (that didn't work):**
Försökte skapa plugin-tabeller (invoices, user_files) i AUTH-databasen via setup-database.js.

✅ **What we do instead (that works):**

```bash
# AUTH-databas tabeller (DATABASE_URL):
# - users, sessions, tenants, user_plugin_access, user_settings

# TENANT-databas tabeller (per tenant/user):
# - contacts, notes, tasks, estimates, invoices, user_files

# För att skapa tenant-tabeller, använd migrations i server/migrations/
```

💡 **Why (lesson learned):**
Det finns TVÅ databaser: AUTH-databas (users, sessions, tenants) och TENANT-databas (contacts, notes, tasks, etc.). `setup-database.js` skapar tabeller i AUTH-databasen. Plugin-tabeller behöver finnas i TENANT-databasen. Core settings (user_settings) → AUTH-databas. Plugin data (invoices, files) → TENANT-databas. Om du ser "relation does not exist" för plugin-data → tabellen saknas i tenant-databasen.

---

## Development Workflow

### React Hooks måste ALLTID vara före early returns i viktiga filer

❌ **What we did (that didn't work):**

```tsx
// ❌ KRITISK FEL - Hooks efter early returns bryter Rules of Hooks
const AppContent = () => {
  const [currentPage, setCurrentPage] = useState(...);
  // ... andra hooks ...

  if (isLoading) {
    return <LoadingScreen />; // Early return
  }

  if (!isAuthenticated) {
    return <LoginComponent />; // Early return
  }

  // ❌ FEL - useMemo efter early returns
  const currentPagePlugin = useMemo(() => {...}, [currentPage]);
  const contentTitle = useMemo(() => {...}, [currentPage, currentPagePlugin]);
  const primaryAction = useMemo(() => {...}, [currentPage, ...]);
  // React Error: "Rendered more hooks than during the previous render"
};
```

✅ **What we do instead (that works):**

```tsx
// ✅ KORREKT - ALLA hooks före early returns
const AppContent = () => {
  const [currentPage, setCurrentPage] = useState(...);
  // ... alla hooks först ...

  // ✅ ALLA useMemo/useEffect/useCallback MÅSTE vara här, FÖRE early returns
  const currentPagePlugin = useMemo(() => {...}, [currentPage]);
  const contentTitle = useMemo(() => {...}, [currentPage, currentPagePlugin]);
  const primaryAction = useMemo(() => {...}, [currentPage, ...]);

  // ✅ FÖRST EFTER alla hooks - då kan vi ha early returns
  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <LoginComponent />;
  }

  // Resten av komponenten...
};
```

💡 **Why (lesson learned):**
**KRITISKT för viktiga filer som App.tsx, MainLayout, AppContext, PluginRegistry**: React's Rules of Hooks kräver att hooks anropas i **exakt samma ordning** vid varje render. Om hooks ligger efter early returns anropas de ibland (när villkoren är falska) och ibland inte (när villkoren är sanna). Detta kraschar appen med "Rendered more hooks than during the previous render". I viktiga filer som är grunden för hela appen kan detta göra att ingenting fungerar. **ALLA hooks (useState, useEffect, useMemo, useCallback) MÅSTE alltid vara före eventuella early returns.**

---

### Login fungerar men UI visar inte - kolla båda servrarna

❌ **What we did (that didn't work):**
Backend fungerar (login returnerar 200) men frontend visar inte inloggningsskärmen eller data.

✅ **What we do instead (that works):**

```bash
# Kolla om båda servrar körs:
lsof -i:3001  # Frontend (Vite)
lsof -i:3002  # Backend (Express)

# Starta båda:
npm run dev:all  # Eller i separata terminals:
npm run dev:api  # Backend
npm run dev:ui   # Frontend
```

💡 **Why (lesson learned):**
Vanliga orsaker: 1) Frontend körs inte - `npm run dev` startar bara backend, 2) Port-konflikt - Frontend ska vara på port 3001, backend på 3002, 3) Browser cache - Hårda refresh krävs (Cmd+Shift+R). Om backend säger "User logged in" men UI inte uppdateras → frontend körs troligen inte eller har cache-problem.

---

### @homebase/core måste finnas i dependencies för att plugins ska ladda

❌ **What we did (that didn't work):**
Backend kraschade med "Cannot find module '@homebase/core'" när plugins försökte ladda.

✅ **What we do instead (that works):**

```json
// package.json
{
  "dependencies": {
    "@homebase/core": "file:packages/core"
    // ...
  }
}
```

```bash
npm install  # Installerar lokal dependency
```

💡 **Why (lesson learned):**
Plugins använder `require('@homebase/core')` men paketet måste vara installerat som dependency, även om det är ett lokalt paket. Efter att ha lagt till dependency måste `npm install` köras. Utan detta misslyckas plugin-laddning och backend kan inte starta korrekt.

---

## Plugin Development

### existing.rows.length används felaktigt i några plugins

❌ **What we did (that didn't work):**

```javascript
// contacts/model.js använder existing.rows.length
const existing = await db.query('SELECT * FROM contacts WHERE id = $1', [contactId]);
if (existing.rows.length === 0) { // ❌ existing är redan en array
```

✅ **What we do instead (that works):**

```javascript
// db.query() returnerar rows-array direkt
const existing = await db.query('SELECT * FROM contacts WHERE id = $1', [contactId]);
if (!existing || existing.length === 0) {
  throw new AppError('Contact not found', 404);
}
```

💡 **Why (lesson learned):**
`db.query()` returnerar en array direkt (från PostgreSQLAdapter som returnerar `result.rows`), inte ett objekt med `.rows` property. Alla plugins som använder `db.query()` måste kontrollera `existing.length`, inte `existing.rows.length`.

---

### Priority kan skrivas över med || operator

❌ **What we did (that didn't work):**

```javascript
// Om priority är 'Low', blir det 'Medium' eftersom 'Low' är truthy
priority: priority || 'Medium', // ❌ Överskriver 'Low'
```

✅ **What we do instead (that works):**

```javascript
// Använd nullish coalescing för att bara använda default vid null/undefined
priority: priority ?? 'Medium', // ✅ Bevara 'Low', 'Medium', 'High'
```

💡 **Why (lesson learned):**
`||` operatorn returnerar höger operand om vänster är falsy. Eftersom 'Low' är truthy borde det fungera, men om priority är undefined eller null kan det bli problem. `??` operatorn returnerar höger operand endast om vänster är null eller undefined, vilket bevarar alla giltiga priority-värden.

---

## List View & Rendering

### ESLint react/no-array-index-key varningar i listor

❌ **What we did (that didn't work):**

```typescript
// Använder index som key i map-funktioner
{mentions.map((mention, index) => (
  <div key={index}>...</div> // ❌ ESLint varning
))}
```

✅ **What we do instead (that works):**

```typescript
// Använd unika identifierare från data
{mentions.map((mention) => (
  <div key={`mention-${mention.contactId}-${mention.contactName || 'unknown'}`}>
    ...
  </div>
))}
```

💡 **Why (lesson learned):**
Array index som keys kan orsaka rendering-problem när listan ändras. Använd alltid unika identifierare från data (ID, kombination av fält). Om data saknar ID, skapa en kombination av unika fält som key.

---

### GroupedList måste ha unika keys för items

❌ **What we did (that didn't work):**

```typescript
// Använde index som key i GroupedList rendering
{items.map((item, idx) => (
  <div key={idx}>...</div> // ❌ Problem vid sortering/omordning
))}
```

✅ **What we do instead (that works):**

```typescript
// Använd item.id eller fallback till kombination
{items.map((item, idx) => (
  <div key={item.id || `item-${idx}`}>...</div>
))}
```

💡 **Why (lesson learned):**
GroupedList renderar items som kan omordnas vid sortering eller gruppering. Unika keys säkerställer att React kan effektivt uppdatera DOM:en. Om item.id saknas, skapa en stabil key baserad på item-data.

---

## Date & Formatting

### formatDueDate behöver error handling för ogiltiga datum

❌ **What we did (that didn't work):**

```typescript
// Funktion kraschar med ogiltiga datum
const formatDueDate = (dueDate: any) => {
  const due = new Date(dueDate); // ❌ Kan bli Invalid Date
  const diffTime = due.getTime() - now.getTime(); // ❌ NaN om ogiltigt datum
};
```

✅ **What we do instead (that works):**

```typescript
const formatDueDate = (dueDate: any) => {
  if (!dueDate) return null;

  try {
    const due = new Date(dueDate);
    if (isNaN(due.getTime())) {
      return null; // Ogiltigt datum
    }

    const diffTime = due.getTime() - now.getTime();
    // ... resten av logiken
  } catch (error) {
    return null; // Hantera fel gracefully
  }
};
```

💡 **Why (lesson learned):**
Datum kan vara null, undefined, eller ogiltiga strängar. Alltid validera datum med `isNaN(date.getTime())` innan du använder dem. Lägg alltid try-catch runt datum-beräkningar för att undvika kraschar. Returnera null eller fallback-värde vid fel istället för att krascha.

---

### Date-objekt kan behöva konverteras till sträng för backend

❌ **What we did (that didn't work):**

```typescript
// Skickar Date-objekt direkt till backend
const updatedData = {
  dueDate: task.dueDate, // Date-objekt
};
await saveTask(updatedData); // Backend förväntar sig sträng
```

✅ **What we do instead (that works):**

```typescript
// Konvertera Date till ISO-sträng för backend
const updatedData = {
  dueDate: task.dueDate instanceof Date ? task.dueDate.toISOString().split('T')[0] : task.dueDate,
};
await saveTask(updatedData); // Backend får korrekt format
```

💡 **Why (lesson learned):**
Backend förväntar sig datum som ISO-strängar eller null, inte Date-objekt. API-lagret måste konvertera Date-objekt till strängar innan de skickas. Använd `toISOString().split('T')[0]` för att få YYYY-MM-DD format som PostgreSQL förväntar sig.

---

## Debugging

### "Cannot read properties of undefined (reading 'map')"

**Symptom:** Runtime-fel när du försöker använda `.map()` på undefined.

**Debug:**

```javascript
const result = await db.query('SELECT * FROM notes', []);
console.log('Query result:', result, 'Type:', typeof result, 'Is array:', Array.isArray(result));
```

**Lösning:** Ta bort `.rows` - query() returnerar rows direkt. Om result är undefined, kontrollera att query faktiskt kördes och att fel inte kastades.

---

### "ServiceManager is not defined"

**Symptom:** Runtime-fel när plugin försöker använda ServiceManager.

**Debug:** Sök efter alla `ServiceManager` i filen.

**Lösning:** Importera och använd SDK istället:

```javascript
const { Logger, Database } = require('@homebase/core');
```

---

### "User context required for update"

**Symptom:** 400 eller 401 fel när du försöker uppdatera data.

**Debug:** Kolla att requireAuth() middleware används på routen och att req.session finns.

**Lösning:** SDK hämtar context från req automatiskt, men req måste ha session. Verifiera att:

1. requireAuth() middleware används på routen
2. req.session?.currentTenantUserId eller req.session?.user?.id finns
3. Database.get(req) använder korrekt session-path (currentTenantUserId || user.id)

---

### "context is not defined"

**Symptom:** ReferenceError när kod försöker använda context-variabel.

**Debug:** Ta bort alla `_getContext()` anrop och context-parametrar.

**Lösning:** SDK hanterar context automatiskt - du behöver inte skicka det. Ta bort alla manuella context-parametrar från SDK-anrop.

---

### "Cannot find module '@homebase/core'"

**Symptom:** Backend startar inte och plugins kan inte laddas.

**Debug:** Kolla package.json för @homebase/core dependency och att npm install kördes.

**Lösning:**

```json
// package.json
{
  "dependencies": {
    "@homebase/core": "file:packages/core"
  }
}
```

Kör sedan `npm install` för att länka lokal dependency.

---

## Checklista: När Du Refaktorerar till SDK

**FÖRE du börjar:**

- [ ] Läs SDK-implementationen (`packages/core/src/Database.js`)
- [ ] Förstå vad varje metod returnerar (inte bara vad den gör)
- [ ] Kolla exempel i andra plugins som redan använder SDK

**När du refaktorerar:**

- [ ] Ta bort alla `ServiceManager.get()` anrop
- [ ] Ta bort alla `_getContext()` metoder
- [ ] Ta bort alla context-parametrar från SDK-anrop
- [ ] Ändra `result.rows` till `rows` (eller `result` till `record` för insert/update)
- [ ] Använd `Logger` från SDK, inte `ServiceManager.get('logger')`
- [ ] Använd `priority ?? 'Medium'` istället för `priority || 'Medium'`
- [ ] Kontrollera `existing.length` istället för `existing.rows.length`

**Efter refactoring:**

- [ ] Testa att data faktiskt sparas (inte bara att det kompilerar)
- [ ] Testa att data finns kvar efter refresh
- [ ] Kolla loggarna för "undefined" eller "is not defined" errors
- [ ] Testa quick actions om det är en plugin med sådana funktioner

---

**Senast uppdaterad:** 2026-01-17  
**Syfte:** Undvika att upprepa samma misstag  
**Lärdom:** Läs implementationen, testa funktionalitet, följ SDK:ns design, håll det enkelt

# Lessons Learned

**Syfte**: Dokumentera misstag och lärdomar för att undvika att upprepa dem.  
**Format**: ❌ What we did (that didn't work) → ✅ What we do instead (that works) → 💡 Why (lesson learned)

---

## Database SDK

> **Note:** Detaljerad dokumentation om Database SDK finns nu i `BACKEND_PLUGIN_GUIDE_V2.md` under "Database SDK Common Pitfalls".

**Kort sammanfattning:**

- `db.query()` returnerar rows direkt (array), inte `{rows: [...]}`
- `db.insert()` returnerar record direkt, inte `{rows: [...]}`
- Använd INTE ServiceManager direkt i plugins - använd SDK
- Context är redan inbyggt i `Database.get(req)` - skicka INTE manuellt
- Använd `priority ?? 'Medium'` istället för `priority || 'Medium'`

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

> **Note:** Detaljerad dokumentation om frontend API patterns finns nu i `FRONTEND_PLUGIN_GUIDE_V2.md` under "Common Pitfalls & Best Practices".

**Kort sammanfattning:**

- Quick actions måste skicka explicit `taskId` för att undvika state-mismatch
- `getPanelSubtitle` måste använda `useCallback` med dependencies för cross-plugin data
- ID-jämförelser måste hantera både string och number (konvertera till string)

---

## Database & Setup

> **Note:** Detaljerad dokumentation om development workflow finns nu i `DEVELOPMENT_GUIDE_V2.md` under "Development Workflow".

**Kort sammanfattning:**

- `npm run dev` startar bara backend - använd `npm run dev:all` för båda
- Nya tabeller kräver att `setup-database.js` körs
- AUTH-databas vs TENANT-databas - viktig skillnad
- Login 500 error: Kontrollera att core services inte använder `.rows` på PostgreSQLAdapter-resultat

---

## Development Workflow

> **Note:** Detaljerad dokumentation om development workflow finns nu i `DEVELOPMENT_GUIDE_V2.md` under "Development Workflow".

**Kort sammanfattning:**

- React Hooks måste ALLTID vara före early returns i viktiga filer
- Git commit kräver att ESLint/Prettier passerar INNAN commit
- Variabler måste deklareras FÖRE de används (TDZ)
- Login fungerar men UI visar inte - kolla båda servrarna
- @homebase/core måste finnas i dependencies för att plugins ska ladda

---

## Plugin Development

> **Note:** Detaljerad dokumentation om plugin development finns nu i:
>
> - `BACKEND_PLUGIN_GUIDE_V2.md` - Backend plugin development
> - `FRONTEND_PLUGIN_GUIDE_V2.md` - Frontend plugin development

**Kort sammanfattning:**

- `db.query()` returnerar rows-array direkt - använd `existing.length`, inte `existing.rows.length`
- Använd `priority ?? 'Medium'` istället för `priority || 'Medium'`

---

## List View & Rendering

> **Note:** Detaljerad dokumentation om frontend rendering finns nu i `FRONTEND_PLUGIN_GUIDE_V2.md` under "Common Pitfalls & Best Practices".

**Kort sammanfattning:**

- ESLint react/no-array-index-key: Använd unika identifierare från data, inte index
- GroupedList måste ha unika keys för items
- Date-objekt måste konverteras till sträng för backend
- formatDueDate behöver error handling för ogiltiga datum

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

> **Note:** Detaljerad dokumentation om SDK-refactoring finns nu i `BACKEND_PLUGIN_GUIDE_V2.md` under "Database SDK Common Pitfalls" och `REFACTORING_EXISTING_PLUGINS.md`.

**Kort checklista:**

- [ ] Läs SDK-implementationen (`packages/core/src/Database.js`)
- [ ] Ta bort alla `ServiceManager.get()` anrop
- [ ] Ta bort alla `_getContext()` metoder
- [ ] Ändra `result.rows` till `rows` (eller `result` till `record` för insert/update)
- [ ] Kontrollera `existing.length` istället för `existing.rows.length`
- [ ] Testa att data faktiskt sparas (inte bara att det kompilerar)

---

---

## Activity Log & Middleware

> **Note:** Detaljerad dokumentation om middleware och activity log finns nu i `CORE_ARCHITECTURE_V2.md` under "Core Implementation Details".

**Kort sammanfattning:**

- Middleware måste registreras i `server/index.ts`, inte bara i `setup.js`
- DELETE requests kräver att entity name hämtas FÖRE deletion
- CREATE requests måste hämta entity ID från response
- Activity log tabeller måste skapas per tenant via migration
- Debug logging är kritisk för middleware-felsökning

---

---

## Panel Subtitle & Cross-Plugin Data

> **Note:** Detaljerad dokumentation om cross-plugin data finns nu i `FRONTEND_PLUGIN_GUIDE_V2.md` under "Common Pitfalls & Best Practices".

**Kort sammanfattning:**

- `getPanelSubtitle` måste använda `useCallback` med dependencies för cross-plugin data
- ID-jämförelse måste hantera både string och number (konvertera till string)

---

---

## Plugin Architecture & Refactoring

### Använd PluginLoader för dynamisk plugin-lista istället för hårdkodad lista

❌ **What we did (that didn't work):**

```javascript
// Hårdkodad plugin-lista i auth.js
const availablePlugins = [
  'contacts',
  'notes',
  'estimates',
  'tasks',
  'invoices',
  'products',
  'channels',
  'files',
  'rail',
  'woocommerce-products',
];
// Nya plugins måste läggas till manuellt här
```

✅ **What we do instead (that works):**

```javascript
// Använd PluginLoader för dynamisk lista
function setupAuthRoutes(mainPool, limiter, authMiddleware, loader) {
  authLimiter = limiter;
  requireAuth = authMiddleware;
  pluginLoader = loader; // ✅ Inject PluginLoader
}

// I signup route:
let availablePlugins = [];
if (pluginLoader) {
  availablePlugins = pluginLoader.getAllPlugins().map((p) => p.name); // ✅ Dynamisk
} else {
  // Fallback om pluginLoader inte finns (failsafe)
  availablePlugins = [...]; // Hårdkodad fallback
}
```

💡 **Why (lesson learned):**
Hårdkodade plugin-listor måste uppdateras manuellt när nya plugins läggs till, vilket leder till inkonsistens och glömda plugins. Genom att använda `PluginLoader.getAllPlugins()` får man alltid en aktuell lista över alla registrerade plugins. Detta gör koden mer dynamisk, underhållbar och säkerställer att nya plugins automatiskt inkluderas. Lägg alltid till en fallback för failsafe om PluginLoader inte är tillgänglig.

---

### Ta bort oanvända middleware-setup filer

❌ **What we did (that didn't work):**

```javascript
// server/core/middleware/setup.js
// Filen användes inte längre men fanns kvar
// Middleware registreras direkt i server/index.ts
```

✅ **What we do instead (that works):**

```bash
# Ta bort oanvända filer
rm server/core/middleware/setup.js
# Middleware registreras direkt där den används (server/index.ts)
```

💡 **Why (lesson learned):**
Oanvända filer skapar förvirring och gör det svårt att förstå var kod faktiskt körs. Om en fil inte används (t.ex. middleware registreras direkt i `server/index.ts` istället för via `setup.js`), ta bort den. Detta gör kodbasen renare och lättare att navigera. Kontrollera ALLTID att en fil verkligen används innan du tar bort den genom att söka efter imports/references.

---

---

## Bulk Operations & Hybrid Approach

> **Note:** Detaljerad dokumentation om bulk operations finns nu i `BACKEND_PLUGIN_GUIDE_V2.md` under "Bulk Operations with Foreign Key Relationships" och i `CORE_ARCHITECTURE_V2.md` under "PostgreSQLAdapter.\_addTenantFilter()".

**Kort sammanfattning:**

- Hybrid-lösning: Plugin-specifik pre-deletion + generisk core-helper för bulk delete
- PostgreSQLAdapter.\_addTenantFilter() måste hantera RETURNING-klausuler korrekt (infoga FÖRE RETURNING, inte efter)

---

**Senast uppdaterad:** 2026-01-27  
**Syfte:** Undvika att upprepa samma misstag  
**Lärdom:** Läs implementationen, testa funktionalitet, följ SDK:ns design, håll det enkelt, registrera middleware i rätt fil, debug logging är kritisk, använd useCallback för cross-plugin data i panel subtitles, använd PluginLoader för dynamiska plugin-listor, ta bort oanvända filer, PostgreSQLAdapter returnerar rows direkt (array) - använd inte .rows i core services, hybrid-lösning för bulk delete: plugin-specifik pre-deletion + generisk core-helper, PostgreSQLAdapter.\_addTenantFilter() måste hantera RETURNING-klausuler korrekt

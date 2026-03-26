# Lessons Learned

**Syfte**: Dokumentera misstag och lärdomar för att undvika att upprepa dem.  
**Format**: ❌ What we did (that didn't work) → ✅ What we do instead (that works) → 💡 Why (lesson learned)

---

## ⚠️ Överordnad princip: Ta inte sönder plattformen

**Det är av yttersta vikt att inget arbete (refaktorering, nya features, buggfixar) får ta sönder plattformen.** Navigation mellan sidor/plugins, panelöppning/stängning, inloggning och grundläggande CRUD ska fortsätta fungera. Vid osäkerhet: läs befintlig implementation, felsök strukturerat (repro → orsak → fix), och undvik gissningar. Läs denna dokumentation och följ etablerade patterns innan större ändringar.

---

## Database SDK

> **Note:** Se även `CORE_SERVICES_ARCHITECTURE.md` (service-översikt) och `REFACTORING_EXISTING_PLUGINS.md` (migrering).

**Kort sammanfattning:**

- `db.query()` returnerar rows direkt (array), inte `{rows: [...]}`
- `db.insert()` returnerar record direkt, inte `{rows: [...]}`
- Använd INTE ServiceManager direkt i plugins - använd SDK
- Context är redan inbyggt i `Database.get(req)` - skicka INTE manuellt
- Använd `priority ?? 'Medium'` istället för `priority || 'Medium'`

---

## Layout & UI

### Använd aldrig `cn()` eller andra verktyg utan import

❌ **What we did (that didn't work):**
I en komponent (t.ex. TaskAssigneeSelect) lade vi till `className={cn('block truncate', ...)}` utan att importera `cn` från `@/lib/utils`. Komponenten kraschade vid render (ReferenceError: cn is not defined) och hela appen visade blank skärm.

✅ **What we do instead (that works):**

```tsx
// ✅ KORREKT – importera cn innan användning
import { cn } from '@/lib/utils';

// sedan i JSX
<span className={cn('block truncate', !x && 'text-muted-foreground italic')}>
```

💡 **Why (lesson learned):**
Om en referens (funktion/konstant) används men inte är importerad, kastar JavaScript ReferenceError. I React leder det till att komponenten kraschar och användaren får blank skärm. Vid små UI-ändringar (t.ex. lägga till `cn()` för classNames): kontrollera alltid att nödvändiga imports finns i filen.

---

### Plugin-ombyggnad: ändra inte bara UI, ändra hela kedjan

❌ **What we did (that didn't work):**  
Vi började med att uppdatera enskilda UI-delar (t.ex. Assigned/properties) utan att samtidigt uppdatera hela dataflödet (list/search/export/context/backend) för den nya semantiken.

✅ **What we do instead (that works):**

- Behandla funktionsändringar som **end-to-end**:
  - migration
  - model/routes validering
  - API mapping
  - typer
  - context/quick-edit
  - list/search/export
  - detail/form UI
- Behåll bakåtkompatibel fallback under övergång (legacy-fält + normalisering).

💡 **Why (lesson learned):**  
Delvis implementation skapar inkonsekvenser: view kan se rätt ut men list/export/quick-edit visar fel data eller ignorerar nya fält.

---

### Design-alignering måste vara konsekvent per sektion

❌ **What we did (that didn't work):**  
Vi blandade patterns i samma sektion (t.ex. mentions i tasks med en tredje variant som inte matchade notes/slots fullt ut).

✅ **What we do instead (that works):**

- Välj ett referensmönster per sektion (slots eller notes) och kopiera:
  - struktur
  - spacing
  - typografi
  - actions (ikon-only vs textknapp)
- För properties: håll `text-sm` labels + `h-9` controls + `text-xs` control text.
- För date/time i samma fältgrupp: matcha samma trigger/popover-utseende.

💡 **Why (lesson learned):**  
Konsekvent mönster minskar visuell friktion och gör att användaren kan återanvända muskelminne mellan plugins.

---

### Följ befintliga patterns strikt

❌ **What we did (that didn't work):**
Skapade settings routes med nytt pattern som inte matchade befintliga core routes (t.ex. `server/core/routes/auth.js`, `server/core/routes/admin.js`) och dependency-injection från `server/index.ts`.

✅ **What we do instead (that works):**

```javascript
// ✅ KORREKT - Följer samma DI-pattern som core routes
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
As of the Settings-plugin migration, Settings is implemented as an always-on plugin and uses the same routing/panel flow as other plugins (no special case). When adding new nav pages, still update all places where the NavPage type is used.

---

### Rate-limit skip-regler måste matcha mountad path

❌ **What we did (that didn't work):**  
Vi antog att `req.path` alltid innehåller `/api/...` och skrev skip-regler i global rate limiter som bara matchade `/api/auth/login`, `/api/auth/me`, `/api/health` osv. När limitern mountades med `app.use('/api', ...)` stripades prefixet, vilket gjorde att skip-reglerna inte träffade. Resultatet blev felaktig throttling av login i dev (`429 Too Many Requests`).

✅ **What we do instead (that works):**

- Skriv skip-logik som matchar både prefixed och stripped paths när middleware är mountad under en baspath.
- Exempel: matcha både `/auth/login` och `/api/auth/login` (samma för `me`, `health`, `csrf-token`).
- Verifiera alltid med ett verkligt endpoint-anrop (`curl` eller motsvarande) efter ändring i limiter.

💡 **Why (lesson learned):**  
Express ändrar hur `req.path` ser ut beroende på var middleware mountas. Om skip-regler inte tar hänsyn till det kan kritiska endpoints (inloggning/session) oavsiktligt rate-limitas och plattformen upplevs som trasig trots korrekt auth-logik.

---

### Undvik “dubbel panel”-special-casing

❌ **What we did (that didn't work):**
Byggde separata panel-flöden för plugins och settings (t.ex. två olika panel-komponenter eller två parallella “isOpen”-states), vilket skapade state-konflikter och svåra edge cases.

✅ **What we do instead (that works):**

- **En panel-implementation:** Använd den gemensamma `DetailPanel`/`PanelFooter`-mekanismen för allt panelinnehåll.
- **Settings är en plugin:** Settings hanteras som en always-on plugin och följer samma routing/panel-flöde som andra plugins (ingen separat “settings panel”).
- **Per-plugin vy-state:** Om en plugin har flera vyer (t.ex. list vs settings), använd pluginens egna `contentView`/mode och låt core vara agnostisk.

💡 **Why (lesson learned):**
Att ha ett enda panel-flöde minskar specialfall, förenklar close/save/cancel, och gör att nya plugins (inkl. Settings) kan följa samma regler utan att core behöver “veta” om dem.

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

## React / Hooks

### Deklarera callbacks före useEffect som använder dem (undvik TDZ)

❌ **What we did (that didn't work):**
I formulär (t.ex. NoteForm, ContactForm) hade vi en `useEffect` som anropade `resetForm()` i dependency-arrayen och i else-grenen, medan `const resetForm = useCallback(...)` deklarerades längre ner i komponenten.

✅ **What we do instead (that works):**

```tsx
// ✅ KORREKT – resetForm deklareras FÖRE useEffect som använder den
const resetForm = useCallback(() => {
  setFormData({ ... });
  markClean();
}, [markClean]);

useEffect(() => {
  if (currentItem) {
    setFormData(/* load from currentItem */);
    markClean();
  } else {
    resetForm();
  }
}, [currentItem, markClean, resetForm]);
```

💡 **Why (lesson learned):**
I JavaScript/React gäller "Temporal Dead Zone" (TDZ): en variabel får inte användas före sin deklaration. Om en `useEffect` (eller annan kod) refererar till `resetForm` innan `const resetForm = useCallback(...)` har körts, får du `ReferenceError: Cannot access 'resetForm' before initialization`. Alltid deklarera `useCallback`/`useMemo` (och andra identifierare) **ovanför** alla `useEffect` som använder dem.

---

## API & Context

> **Note:** Se även `SECURITY_GUIDELINES.md` (CSRF + middleware) och `PLUGIN_DEVELOPMENT_STANDARDS_V2.md` (konventioner).

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

## Authentication & Tenant Context (Design Changes)

### Designändringar som lägger till nya sökvägar måste inte bryta legacy

❌ **What we did (that didn't work):**
Efter en designändring (multi-tenant / RBAC med `tenant_memberships` och `owner_user_id` på `tenants`) slutade inloggning fungera för befintliga användare. Tenant-context hämtades **först** via de nya sökvägarna (membership, sedan owner med `owner_user_id`). I äldre/legacy-databas fanns bara `tenants.user_id` och `tenants.neon_connection_string`. När de nya sökvägarna kördes först kastade SQL (saknad kolumn/tabell) eller gav tomt, och den legacy-vänliga sökvägen (bara `tenants WHERE user_id = ?`) kördes inte tillräckligt tidigt. Då returnerade `getTenantContextByUserId` `null` och inloggning gav "Tenant database not configured".

✅ **What we do instead (that works):**

- **Legacy-först vid lookup:** Den gamla, fungerande sökvägen (som inte kräver nya schema) körs **först**. I `TenantContextService.getTenantContextByUserId`: först `SELECT id, neon_connection_string, user_id FROM tenants WHERE user_id = $1`. Om den ger träff → returnera. Sedan prova membership- och owner-sökvägarna.
- **Schema-oberoende:** Koden ska inte anta att `tenant_memberships` eller `owner_user_id` finns. Varje ny sökväg i egen try/catch så att fel inte blockerar legacy.
- **Tydlig fallback-ordning:** Dokumentera och testa ordningen (1) legacy, 2) membership, 3) owner så att befintliga installationer fungerar utan migration.

💡 **Why (lesson learned):**
En designåtgärd kan göra att inloggning slutar fungera om den byter **hur** systemet hittar tenant/session (nya tabeller/kolumner) och gör den **gamla sökvägen** beroende av att de nya lyckas – när de nya failar i nuvarande DB används den gamla inte. Alltid säkerställ att den sökväg som fungerar i dagens schema körs först eller åtminstone alltid körs som fallback; rensa sedan gammal kod (t.ex. döda kommentarer) så att bara en tydlig ordning finns.

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
> - `PLUGIN_DEVELOPMENT_STANDARDS_V2.md` - Plugin conventions (frontend + backend)
> - `SECURITY_GUIDELINES.md` - Security enforcement

**Kort sammanfattning:**

- `db.query()` returnerar rows-array direkt - använd `existing.length`, inte `existing.rows.length`
- Använd `priority ?? 'Medium'` istället för `priority || 'Medium'`
- Starta alltid från golden templates (`templates/plugin-frontend-template`, `templates/plugin-backend-template`) för att undvika contract-drift mellan plugins

---

## List View & Rendering

> **Note:** Se även `UI_AND_UX_STANDARDS_V3.md` för UI/UX-standarder.

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

> **Note:** Se även `REFACTORING_EXISTING_PLUGINS.md`.

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

> **Note:** Se även `CORE_ARCHITECTURE_V2.md` (AppContext) och `MENTIONS_AND_CROSS_PLUGIN_UI.md`.

**Kort sammanfattning:**

- `getPanelSubtitle` måste använda `useCallback` med dependencies för cross-plugin data
- ID-jämförelse måste hantera både string och number (konvertera till string)

---

---

## Plugin Architecture & Refactoring

### Använd PluginLoader för dynamisk plugin-lista istället för hårdkodad lista

❌ **What we did (that didn't work):**

```javascript
// Hårdkodad plugin-lista (undvik)
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

✅ **Vad som gäller nu (aktuellt):**

- Middleware registreras **direkt i** `server/index.ts` (det finns ingen central `setupMiddleware()` som “automatiskt” plockar upp nya middleware-filer).
- Skapa inte nya “setup”-filer för middleware. Lägg istället in middleware där den faktiskt används i serverns bootstrap (`server/index.ts`) så körordning och ansvar är tydligt.

💡 **Why (lesson learned):**
Oanvända/“magiska” setup-lager skapar förvirring om var kod faktiskt körs. Genom att registrera middleware explicit i `server/index.ts` blir körordningen tydlig och det blir svårt att råka missa att en ny middleware aldrig kopplats in.

---

---

## Validation (express-validator) & Optional Fields

### Optional fält: använd `optional({ values: 'falsy' })` för tom sträng

❌ **What we did (that didn't work):**
E-post och telefon var valfria men backend gav "Invalid email address" / "phone must be a valid phone number" när användaren sparade med tomma fält. Vi använde `.optional()` på reglerna.

✅ **What we do instead (that works):**

```javascript
// validation.js – email och phone
body('email').optional({ values: 'falsy' }).isEmail()...
body(field).optional({ values: 'falsy' }).matches(/^\+?[0-9\s\-()]+$/)...
```

💡 **Why (lesson learned):**
I express-validator anser `.optional()` bara att fältet är "frånvarande" när värdet är `undefined`. Skickas `email: ""` eller `phone: ""` körs formatvalideringen ändå. Med `.optional({ values: 'falsy' })` räknas `''`, `null` och `undefined` som frånvaro, så formatvalidering körs bara när användaren fyllt i något.

---

## Layout & Scroll (Flex)

### Scroll i flex-panel: använd `min-h-0` på flex-barn

❌ **What we did (that didn't work):**
Detail-panelen i add-läge rullade "mer än den ska" – hela panelen eller sidan scrollade istället för bara innehållet.

✅ **What we do instead (that works):**

```tsx
// Yttre panel-container
<div className="h-full min-h-0 flex flex-col ...">
  {/* Scrollbar-area */}
  <div className="flex-1 min-h-0 overflow-y-auto ...">{children}</div>
</div>
```

💡 **Why (lesson learned):**
Flex-barn har implicit `min-height: auto`, vilket kan hindra dem från att krympa under innehållets höjd. Då växer containern och scroll sker på fel nivå. `min-h-0` låter flex-barnet krympa så att bara den inre `overflow-y-auto`-diven får scroll.

---

## Panel & Forms (Discard Changes)

### Edit-läge: "Discard changes" ska växla tillbaka till view

❌ **What we did (that didn't work):**
I edit-läge (Contacts/Notes/Tasks): Cancel → dialog "Vill du verkligen lämna?" → användaren klickar "Discard changes" men panelen stannade kvar i edit-läge.

✅ **What we do instead (that works):**

```tsx
const handleDiscardChanges = () => {
  if (!currentItem) {
    resetForm();
    setTimeout(() => confirmDiscard(), 0);
  } else {
    confirmDiscard(); // stänger dialog, kör pending action
    onCancel(); // explicit: växla tillbaka till detail view
  }
};
```

💡 **Why (lesson learned):**
`confirmDiscard()` kör den sparade pending action (som är `onCancel`). För att panelen ska växla tillbaka till view-läge tillförlitligt, anropa dessutom `onCancel()` explicit i edit-fallet så att view-läget alltid sätts.

---

## Plugin-specifik Close-hantering (Tasks quick-edit)

### Close med "osparade ändringar" – plugin tillhandahåller getCloseHandler

❌ **What we did (that didn't work):**
Tasks quick-edit behövde visa "Discard changes?" när användaren klickar Close med osparade ändringar. Generisk close-handler utan plugin-wrapper räckte inte.

✅ **What we do instead (that works):**

- TaskContext exponerar `getCloseHandler(defaultClose)` som returnerar en funktion: om `hasQuickEditChanges` → visa dialog och spara `defaultClose` i ref; annars anropa `defaultClose()`.
- I panel-actions (header/footer): använd pluginens wrapper `currentPluginContext.getCloseHandler(baseClose)` i stället för bara `baseClose`.

💡 **Why (lesson learned):**
För att en plugin ska kunna "fånga" Close (t.ex. visa dialog) behöver core använda en plugin-specifik wrapper. Genom att låta context exponera `getCloseHandler(defaultClose)` kan både header och footer använda samma korrekta close-handler utan att känna till dialog-state.

### "Discard changes" = stanna i detail view, bara kasta draft

❌ **What we did (that didn't work):**
I quick-edit-dialogen: användaren klickar "Discard changes" och förväntar sig att stanna kvar på task-detail view, men panelen stängdes (list view).

✅ **What we do instead (that works):**

```ts
const onDiscardQuickEditAndClose = useCallback(() => {
  setQuickEditDraft(null);
  setShowDiscardQuickEditDialog(false);
  // Anropa INTE pendingCloseRef.current() – stanna i detail view
}, []);
```

💡 **Why (lesson learned):**
"Discard changes" i quick-edit betyder "kasta mina lokala ändringar och stanna kvar på samma vy". Då ska vi bara rensa draft och stänga dialogen – inte anropa panel-close. Spara anrop till `defaultClose` till när användaren verkligen klickar Close utan att ha discadat (eller efter discarding om ni vill stänga då; här valde vi att stanna i detail view).

---

## Bulk Operations & Hybrid Approach

> **Note:** Se även `CORE_ARCHITECTURE_V2.md` (bulk + tenant-scope) och `CORE_SERVICES_ARCHITECTURE.md` (databas/adapters).

**Kort sammanfattning:**

- Hybrid-lösning: Plugin-specifik pre-deletion + generisk core-helper för bulk delete
- PostgreSQLAdapter.\_addTenantFilter() måste hantera RETURNING-klausuler korrekt (infoga FÖRE RETURNING, inte efter)

---

---

## Duplicate: grön highlight försvinner direkt

### Deep-link-effekt som beror på `[data]`-array rensar `recentlyDuplicatedId`

❌ **What we did (that didn't work):**

```tsx
// ❌ FEL – beror på [notes/tasks/slots], körs om varje gång listan ändras
const didOpenFromUrlRef = useRef(false);
useEffect(() => {
  if (didOpenFromUrlRef.current || items.length === 0) return;
  const slug = getSlugFromUrl();
  if (!slug) return;
  const item = resolveSlug(slug, items);
  if (item) {
    didOpenFromUrlRef.current = true;
    openForView(item); // ← nollsätter recentlyDuplicatedId
  }
}, [items]); // ← triggas vid VARJE listuppdatering, t.ex. efter duplicering
```

Konsekvens: efter duplicering läggs ny post till i listan → `[items]` ändras → effekten körs → `openForView` anropas → `recentlyDuplicatedId` nollsätts → grön highlight försvinner omedelbart.

✅ **What we do instead (that works):**

```tsx
// ✅ RÄTT – beror på location.pathname, ej [items]
const myPluginDeepLinkPathSyncedRef = useRef<string | null>(null);
useEffect(() => {
  if (items.length === 0) return;
  const segments = location.pathname.split('/').filter(Boolean);
  if (segments[0] !== 'my-plugin') return;
  const slug = segments[1] ?? '';
  if (!slug) {
    myPluginDeepLinkPathSyncedRef.current = location.pathname;
    return;
  }
  const pathKey = location.pathname;
  if (myPluginDeepLinkPathSyncedRef.current === pathKey) return; // kör max en gång per unik URL
  const item = resolveSlug(slug, items, 'title');
  myPluginDeepLinkPathSyncedRef.current = pathKey;
  if (item) openForViewRef.current(item);
}, [location.pathname, items]);
```

💡 **Why (lesson learned):**
`location.pathname` ändras bara när användaren navigerar. Listan uppdateras utan URL-ändring efter duplicering, så effekten ignorerar listuppdateringen. Varje unik URL öppnar panelen exakt en gång, och grön highlight störs inte.

---

## Duplicate: `setRecentlyDuplicatedId` destruktureras inte i View

❌ **What we did (that didn't work):**

```tsx
// ❌ FEL – setRecentlyDuplicatedNoteId saknades i destrukturering
const { getDuplicateConfig, executeDuplicate, closePanel } = useNotes();

// Senare i onConfirm:
setRecentlyDuplicatedNoteId(highlightId); // ← ReferenceError: not defined
closePanel(); // ← körs aldrig, panelen fastnar
```

Konsekvens: `ReferenceError` → `closePanel()` anropas aldrig → panelen fastnar i view-läge.

✅ **What we do instead (that works):**

```tsx
// ✅ RÄTT – inkludera ALLTID setRecentlyDuplicated* i destrukturering
const {
  getDuplicateConfig,
  executeDuplicate,
  setRecentlyDuplicatedNoteId, // ← obligatorisk
} = useNotes();
```

💡 **Why (lesson learned):**
`set*`-funktioner från context är inte automatiskt i scope – de måste explicit destruktureras. Om de används i en callback (t.ex. `.then()`) och saknas i destrukturering kastar JavaScript `ReferenceError` vid körning, inte vid kompilering. Kontrollera alltid att **alla** funktioner som används i `onConfirm` faktiskt är destrukturerade.

---

## Duplicate: `closePanel` måste anropas FÖRE `setRecentlyDuplicatedId`

❌ **What we did (that didn't work):**

```tsx
// ❌ FEL – fel ordning
executeDuplicate(item, newName).then(({ closePanel, highlightId }) => {
  if (highlightId) setRecentlyDuplicatedMyPluginId(highlightId); // ← 1. sätts
  closePanel(); // ← 2. closePanel nollsätter id i context
});
```

Konsekvens: `closePanel()` nollsätter `recentlyDuplicatedId` i context (via `openForView(null)` eller liknande), och highlight syns aldrig.

✅ **What we do instead (that works):**

```tsx
// ✅ RÄTT – closePanel FÖRE setRecentlyDuplicatedId
executeDuplicate(item, newName).then(({ closePanel, highlightId }) => {
  closePanel(); // 1. stäng, navigera bort
  if (highlightId) setRecentlyDuplicatedMyPluginId(highlightId); // 2. sätt highlight (efter close)
  setShowDuplicateDialog(false); // 3. stäng dialog
});
```

💡 **Why (lesson learned):**
`closePanel` stänger panelen och nollsätter internt `recentlyDuplicatedId` (via `openForView` reset). Genom att anropa `setRecentlyDuplicatedId` EFTER `closePanel` skriver vi in värdet EFTER nollsättningen. Ordningen är viktig och måste matcha referensimplementationen exakt.

---

## Duplicate: `onDuplicate` ska öppna dialog, inte köra direkt

❌ **What we did (that didn't work):**

```tsx
// ❌ FEL – kör executeDuplicate utan namnprompt
<QuickActionsCard onDuplicate={(item) => executeDuplicate(item, '')} />
```

✅ **What we do instead (that works):**

```tsx
// ✅ RÄTT – öppna dialog som promptar för namn
<QuickActionsCard onDuplicate={() => setShowDuplicateDialog(true)} />
```

💡 **Why (lesson learned):**
Duplicering ska alltid be om ett namn via `DuplicateDialog`. Att anropa `executeDuplicate` direkt med tomt namn ger en post med standardnamn utan att användaren fått chansen att välja – vilket avviker från slots-beteendet.

---

---

## window-bridge borttagning: `*Form.tsx` ska aldrig registrera globala submit/cancel-funktioner

❌ **What we did (that didn't work):**

```ts
// ❌ FEL – registrerar window-global i *Form.tsx (create/edit form)
useEffect(() => {
  (window as any).submitTasksForm = handleSubmit;
  (window as any).cancelTasksForm = handleCancel;
  return () => {
    delete (window as any).submitTasksForm;
    delete (window as any).cancelTasksForm;
  };
}, [handleSubmit, handleCancel, panelMode]);
```

✅ **What we do instead (that works):**

```tsx
// ✅ RÄTT – inline Save/Cancel längst ned i formulärets return-block
<div className="flex justify-end gap-2 pt-4 border-t border-border">
  <Button
    type="button"
    variant="secondary"
    size="sm"
    icon={X}
    onClick={handleCancel}
    disabled={isSubmitting}
    className="h-9 text-xs px-3"
  >
    {t('common.cancel')}
  </Button>
  <Button
    type="button"
    variant="primary"
    size="sm"
    icon={Check}
    onClick={handleSubmit}
    disabled={hasBlockingErrors || isSubmitting}
    className="h-9 text-xs px-3 bg-green-600 hover:bg-green-700 text-white border-none"
  >
    {isSubmitting ? t('common.saving') : currentItem ? t('common.update') : t('common.save')}
  </Button>
</div>
```

💡 **Why (lesson learned):**  
`window.submitXxxForm`-globals är ett antipattern (tight coupling, svårt att debugga, timing-buggar). Formuläret ska äga sina egna actions. `PanelFooter` returnerar `null` för create/edit/view-lägen — det är formulärets ansvar att ha Save/Cancel. Window globals tillåts **bara** i `*SettingsForm`-komponenter (settings-läge) som fortfarande anropas via `PanelFooter`.

---

## Footer-refaktorering: PanelFooter ska inte hantera formulärsubmit

❌ **What we did:**  
`PanelFooter` hade ett stort `if (currentMode === 'view')` block med Delete/Duplicate/Export-knappar, och ett `return` block i botten med Save/Cancel för edit/create. Alla dessa anropades via handlers som i sin tur kallade `window.submitXxxForm`.

✅ **What we do now:**

- View-läge: `PanelFooter` returnerar `null`. QuickActionsCard + ExportOptionsCard i sidebar hanterar Delete/Duplicate/Export.
- Create/Edit-läge: `PanelFooter` returnerar `null`. Formuläret har inline Save/Cancel.
- Settings-läge (`currentPlugin.name === 'settings'` eller `currentMode === 'settings'`): `PanelFooter` renderar Close + Save som anropar window-globals registrerade av `*SettingsForm`.

💡 **Why:** Tydlig separation of concerns. Varje komponent äger sina egna actions. Inga globala sidoeffekter.

---

**Senast uppdaterad:** 2026-03-20  
**Syfte:** Undvika att upprepa samma misstag  
**Lärdom:** Läs implementationen, testa funktionalitet, följ SDK:ns design, håll det enkelt, registrera middleware i rätt fil, debug logging är kritisk, använd useCallback för cross-plugin data i panel subtitles, använd PluginLoader för dynamiska plugin-listor, ta bort oanvända filer, PostgreSQLAdapter returnerar rows direkt (array) - använd inte .rows i core services, hybrid-lösning för bulk delete: plugin-specifik pre-deletion + generisk core-helper, PostgreSQLAdapter.\_addTenantFilter() måste hantera RETURNING-klausuler korrekt. Valfria fält: använd optional({ values: 'falsy' }) i express-validator så att tom sträng inte triggar formatvalidering. Flex-scroll: min-h-0 på flex-barn så att bara scroll-området rullar. Discard changes i edit: anropa onCancel() explicit för att växla tillbaka till view. Plugin-specifik close: exponera getCloseHandler(defaultClose) från context och använd i createPanelFooter. Quick-edit "Discard": kasta bara draft, anropa inte panel-close om användaren ska stanna i detail view. **Auth/tenant:** När nya sökvägar (tabeller/kolumner) införs för tenant-context: kör legacy-sökvägen (som fungerar i nuvarande schema) först så att inloggning inte bryts. **Duplicate/deep-link:** Deep-link-effekten ska bero på `location.pathname`, inte `[items]`-arrayen, annars nollsätts `recentlyDuplicatedId` vid varje listuppdatering. `setRecentlyDuplicated*Id` måste destruktureras i View-komponenten. `closePanel()` måste anropas FÖRE `setRecentlyDuplicatedId`. `onDuplicate` öppnar dialog, anropar inte `executeDuplicate` direkt.

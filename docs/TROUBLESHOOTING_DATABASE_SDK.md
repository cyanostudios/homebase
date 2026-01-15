# Database SDK Troubleshooting Guide

**Datum**: 2026-01-13  
**Syfte**: Dokumentera misstag och fallgropar för att undvika att göra samma fel igen

---

## 🚨 Kritiska Misstag och Feltänk

### Misstag 1: Antog att query() returnerar samma format som pool.query()

**Vad gick fel:**

```javascript
// ❌ FELAKTIGT - Antog att SDK fungerar som pool.query()
const result = await db.query('SELECT * FROM notes', []);
return result.rows.map(this.transformRow); // ❌ result.rows är undefined!
```

**Varför hände det:**

- Utvecklaren var van vid att använda `pool.query()` som returnerar `{ rows: [...] }`
- Antog att Database SDK skulle ha samma API utan att läsa implementationen
- Trodde att SDK bara var en wrapper, inte en omdesign av API:et

**Vad vi lärde oss:**

- **Läs SDK-implementationen FÖRST** - packages/core/src/Database.js visar exakt vad som returneras
- SDK:er kan ha helt annorlunda API än det man är van vid
- Antaganden baserade på "så brukar det vara" leder till buggar

**Korrekt sätt:**

```javascript
// ✅ KORREKT - SDK returnerar rows direkt
const rows = await db.query('SELECT * FROM notes', []);
return rows.map(this.transformRow);
```

**Fallgrop:** När du refaktorerar kod, läs ALLTID den nya API:ets dokumentation/implementation innan du använder den.

---

### Misstag 2: Använde ServiceManager direkt i plugins

**Vad gick fel:**

```javascript
// ❌ FELAKTIGT - ServiceManager är inte tillgänglig i plugin context
const database = ServiceManager.get('database', req);
const logger = ServiceManager.get('logger');
```

**Varför hände det:**

- ServiceManager användes i äldre kod och fungerade där
- Trodde att plugins hade samma tillgång till core-tjänster
- Missförstod arkitekturen - plugins ska vara isolerade från core implementation details

**Vad vi lärde oss:**

- **Plugins ska använda SDK, inte core-tjänster direkt**
- ServiceManager är en intern implementation detail som kan ändras
- SDK:er finns för att ge plugins en stabil, abstraherad interface
- Direkt användning av core-tjänster skapar tight coupling

**Korrekt sätt:**

```javascript
// ✅ KORREKT - Använd SDK som är designad för plugins
const { Logger, Database } = require('@homebase/core');
const db = Database.get(req);
Logger.info('Message', { data });
```

**Fallgrop:** Om något fungerar i core-kod betyder det INTE att det fungerar i plugins. Plugins har en annan context och ska använda SDK.

---

### Misstag 3: Skickade context som parameter trots att det redan fanns inbyggt

**Vad gick fel:**

```javascript
// ❌ FELAKTIGT - Trodde att context måste skickas manuellt
const db = Database.get(req);
const context = this._getContext(req); // Onödig!
const rows = await db.query('SELECT * FROM notes', [], context); // context ignoreras
```

**Varför hände det:**

- Var van vid att manuellt skapa context-objekt
- Trodde att SDK krävde explicit context
- Skapade `_getContext()` metod "för säkerhets skull"
- Läste inte SDK-implementationen som visar att context redan är inbyggt

**Vad vi lärde oss:**

- **SDK:er abstraherar bort komplexitet** - om SDK kräver något, kommer det att vara tydligt
- Extra parametrar som ignoreras är ett tecken på att man missförstått API:et
- `_getContext()` metoder är onödiga när SDK hanterar context automatiskt

**Korrekt sätt:**

```javascript
// ✅ KORREKT - Context är redan inbyggt i Database.get(req)
const db = Database.get(req);
const rows = await db.query('SELECT * FROM notes', []); // Context hanteras automatiskt
```

**Fallgrop:** Om du skapar helper-metoder som SDK redan hanterar, är det ett tecken på att du inte förstått SDK:ns design. Läs implementationen.

---

### Misstag 4: Antog att insert() returnerar samma format som query()

**Vad gick fel:**

```javascript
// ❌ FELAKTIGT - Antog att insert returnerar { rows: [...] }
const result = await db.insert('notes', data);
return this.transformRow(result.rows[0]); // ❌ result.rows finns inte
```

**Varför hände det:**

- Trodde att alla database-metoder skulle ha samma return-format
- Antog konsistens baserat på vad man kände till från pool.query()
- Läste inte dokumentationen för insert()

**Vad vi lärde oss:**

- **Varje metod kan ha olika return-format** - läs dokumentationen för varje metod
- Convenience-metoder (insert, update) returnerar ofta data direkt, inte wrappat
- Antaganden om konsistens kan vara farliga

**Korrekt sätt:**

```javascript
// ✅ KORREKT - insert() returnerar record direkt
const record = await db.insert('notes', data);
return this.transformRow(record);
```

**Fallgrop:** Anta inte att metoder har samma format bara för att de är i samma SDK. Läs dokumentationen för varje metod.

---

## 🧠 Feltänk som Ledde till Problemen

### Feltänk 1: "Det fungerar i core-kod, så det fungerar i plugins"

**Verklighet:** Plugins har isolerad context och måste använda SDK, inte core-tjänster direkt.

### Feltänk 2: "SDK:er är bara wrappers, de fungerar som originalet"

**Verklighet:** SDK:er kan omdesigna API:er helt för att göra dem enklare. Läs implementationen.

### Feltänk 3: "Mer parametrar = mer kontroll = bättre"

**Verklighet:** Bra SDK:er abstraherar bort komplexitet. Om du måste skicka context manuellt, har du missförstått SDK:et.

### Feltänk 4: "Om det inte finns dokumentation, antar jag baserat på vad jag vet"

**Verklighet:** Källkoden ÄR dokumentationen. Läs packages/core/src/Database.js istället för att gissa.

---

## ⚠️ Fallgropar att Undvika

### Fallgrop 1: Refaktorera utan att läsa den nya API:en

**Symptom:** Kod kompilerar men kraschar i runtime med "undefined" errors  
**Lösning:** Läs SDK-implementationen FÖRST, testa sedan

### Fallgrop 2: Kopiera kod från core till plugins

**Symptom:** "ServiceManager is not defined" eller liknande  
**Lösning:** Plugins ska använda SDK, inte core-tjänster. Om core-kod använder ServiceManager, översätt till SDK-ekvivalent.

### Fallgrop 3: Skapa helper-metoder som SDK redan hanterar

**Symptom:** `_getContext()` metoder, manuell context-hantering  
**Lösning:** Om SDK har en metod, använd den. Skapa inte din egen version.

### Fallgrop 4: Anta konsistens mellan metoder

**Symptom:** `result.rows` på insert() eller update()  
**Lösning:** Läs dokumentationen för varje metod individuellt.

### Fallgrop 5: Ignorera runtime-fel och tro att det är "edge cases"

**Symptom:** "Cannot read properties of undefined" - men tror att det bara är vissa fall  
**Lösning:** Om något är undefined, är det ALLTID ett tecken på att du missförstått API:et. Läs implementationen.

---

## 📋 Checklista: När Du Refaktorerar till SDK

**FÖRE du börjar:**

- [ ] Läs SDK-implementationen (packages/core/src/Database.js)
- [ ] Förstå vad varje metod returnerar (inte bara vad den gör)
- [ ] Kolla exempel i andra plugins som redan använder SDK

**När du refaktorerar:**

- [ ] Ta bort alla `ServiceManager.get()` anrop
- [ ] Ta bort alla `_getContext()` metoder
- [ ] Ta bort alla context-parametrar från SDK-anrop
- [ ] Ändra `result.rows` till `rows` (eller `result` till `record` för insert/update)
- [ ] Använd `Logger` från SDK, inte `ServiceManager.get('logger')`

**Efter refactoring:**

- [ ] Testa att data faktiskt sparas (inte bara att det kompilerar)
- [ ] Testa att data finns kvar efter refresh
- [ ] Kolla loggarna för "undefined" eller "is not defined" errors

---

## 🔍 Debugging: När Något Går Fel

### "Cannot read properties of undefined (reading 'map')"

**Orsak:** Du försöker accessa `.rows` på något som redan är rows-arrayen  
**Debug:** Logga vad `db.query()` faktiskt returnerar:

```javascript
const result = await db.query('SELECT * FROM notes', []);
console.log('Query result:', result, 'Type:', typeof result, 'Is array:', Array.isArray(result));
```

**Lösning:** Ta bort `.rows` - query() returnerar rows direkt

### "ServiceManager is not defined"

**Orsak:** Du använder ServiceManager i plugin-kod  
**Debug:** Sök efter alla `ServiceManager` i filen  
**Lösning:** Importera och använd SDK istället:

```javascript
const { Logger, Database } = require('@homebase/core');
```

### "User context required for insert"

**Orsak:** req.session eller req.tenantPool saknas  
**Debug:** Kolla att requireAuth() middleware används på routen  
**Lösning:** SDK hämtar context från req automatiskt, men req måste ha session

### "context is not defined"

**Orsak:** Du försöker använda en context-variabel som inte finns  
**Debug:** Ta bort alla `_getContext()` anrop och context-parametrar  
**Lösning:** SDK hanterar context automatiskt - du behöver inte skicka det

---

## 💡 Lärdomar för Framtiden

1. **Läs implementationen, inte bara dokumentationen**
   - packages/core/src/Database.js visar exakt vad som händer
   - Källkoden är den bästa dokumentationen

2. **Testa faktiskt funktionalitet, inte bara kompilering**
   - Kod kan kompilera men fortfarande vara fel
   - Testa att data sparas och finns kvar efter refresh

3. **SDK:er abstraherar bort komplexitet**
   - Om du måste göra något manuellt som SDK borde hantera, har du missförstått
   - Extra parametrar som ignoreras = röd flagga

4. **Plugins är isolerade från core**
   - Core-kod kan använda ServiceManager, plugins kan inte
   - Plugins måste använda SDK för allt

5. **Antaganden är farliga**
   - "Det fungerar så här" → Verifiera i källkoden
   - "Det borde vara konsistent" → Läs varje metod individuellt

---

## 🎯 Vad Gick Rätt (Efter Vi Lärde Oss)

När vi fixade problemen:

1. ✅ Läs SDK-implementationen först
2. ✅ Testa faktiskt funktionalitet (data sparas, finns kvar efter refresh)
3. ✅ Ta bort onödiga abstraktioner (\_getContext när SDK redan hanterar det)
4. ✅ Följ SDK:ns design istället för att försöka "förbättra" den

---

## 🔧 Settings Implementation Lärdomar (2026-01-14)

### Lärdom 1: Följ befintliga patterns strikt

**Vad vi gjorde rätt:**

- Följde samma mönster som auth.js och admin.js för settings routes
- Använde setupSettingsRoutes() för dependency injection (konsistent med setupAuthRoutes())
- Skapade user_settings tabell med JSONB för flexibilitet

**Kod-exempel:**

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

**Nyckelpunkt:** När du lägger till nya core routes, följ EXAKT samma pattern som befintliga routes (dependency injection, error handling, logging).

---

### Lärdom 2: NavPage type måste uppdateras överallt

**Vad vi gjorde:**

- Uppdaterade `NavPage` type i Sidebar.tsx för att inkludera 'settings'
- Lade till settings-hantering i App.tsx rendering
- Hanterade settings separat från plugins (settings är inte ett plugin)

**Kod-exempel:**

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

**Nyckelpunkt:** Settings är en core-funktion, inte ett plugin. Behandla det som en special case i routing.

---

### Lärdom 3: Separata UniversalPanels för olika syften

**Vad vi gjorde:**

- Plugin-panelen (isAnyPanelOpen) för plugins
- Settings-panelen (isSettingsPanelOpen) för settings
- Två separata UniversalPanel-instanser i App.tsx

**Varför:**

- Plugins och settings har olika panel-state-hantering
- Settings-kategorier behöver separat state (settingsCategory)
- Förhindrar konflikter mellan plugin-paneler och settings-paneler

**Kod-exempel:**

```tsx
// ✅ KORREKT - Separata paneler för olika syften
<UniversalPanel isOpen={isAnyPanelOpen} {...pluginProps}>
  {renderers.renderPanelContent()}
</UniversalPanel>

<UniversalPanel isOpen={isSettingsPanelOpen} {...settingsProps}>
  {settingsCategory === 'profile' && <ProfileSettingsForm />}
</UniversalPanel>
```

**Fallgrop:** Försök INTE att återanvända samma panel-state för både plugins och settings - det leder till state-konflikter.

---

### Lärdom 4: API-metoder i AppContext behöver både interface och implementation

**Vad vi gjorde:**

1. Lade till metoder i `AppContextType` interface
2. Lade till metoder i `api` objektet
3. Skapade wrapper-funktioner i AppProvider
4. Lade till dem i Provider value

**Kod-exempel:**

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

**Fallgrop:** Glöm INTE något av dessa steg - alla fyra krävs för att AppContext ska fungera korrekt.

---

### Lärdom 5: Forms behöver inte alltid full Context-arkitektur

**Vad vi lärde oss:**

- Plugins har full Context (Provider, hook, state management) eftersom de hanterar komplex CRUD
- Settings är enklare - bara load/save operations
- Settings-forms kan använda AppContext direkt istället för egen Context

**Beslut:**

- Skippa SettingsContext för initial implementation
- Använd AppContext.getSettings() och updateSettings() direkt i forms
- Enklare och mindre kod att underhålla

**Nyckelpunkt:** Överdriv inte arkitekturen. Om något är enkelt, håll det enkelt. Contexts är för komplex state-hantering.

---

### Lärdom 6: npm run dev startar BARA backend per default

**Problem:**

- `npm run dev` kör bara `dev:api`, inte frontend
- Frontend måste startas separat med `npm run dev:ui`
- Eller använd `npm run dev:all` för båda

**Lösning:**

```bash
# Antingen separata terminals:
npm run dev:api  # Backend (port 3002)
npm run dev:ui   # Frontend (port 3001)

# Eller allt i en terminal:
npm run dev:all  # Båda samtidigt med concurrently
```

**Nyckelpunkt:** Läs package.json scripts innan du startar servrar.

---

### Lärdom 7: Nya tabeller kräver att setup-database.js körs

**Problem du stöter på:**

```
ERROR: relation "user_settings" does not exist
ERROR: relation "invoices" does not exist
ERROR: relation "user_files" does not exist
```

**Varför händer det:**

- Du lade till `user_settings`-tabellen i `scripts/setup-database.js`
- Men du körde INTE scriptet efter att ha lagt till tabellen
- Databasen har inte den nya tabellen än

**Lösning:**

```bash
# Kör setup-database.js för att skapa alla tabeller
node scripts/setup-database.js

# Verifiera att tabellen skapades
psql $DATABASE_URL -c "\dt" | grep user_settings
```

**Vad som händer:**

1. Script skapar user_settings-tabellen
2. Script skapar default superuser (admin@homebase.se / admin123)
3. Script ger plugin access till superuser
4. Script migrerar mock data

**Nyckelpunkt:** När du lägger till nya tabeller i setup-database.js, måste du **ALLTID** köra scriptet för att uppdatera databasen. Bara att ändra koden räcker inte!

**Troubleshooting:**

- Om du ser "relation does not exist" fel → tabellen finns inte i databasen
- Kör setup-database.js för att skapa den
- Alternativt: skapa en migration istället för att lägga till i setup-database.js
- **VIKTIGT:** setup-database.js skapar tabeller i AUTH-databasen (DATABASE_URL)
- Plugin-tabeller behöver skapas i TENANT-databasen (använd migrations istället)

---

### Lärdom 8: CORS och credentials för cross-origin requests

**Vad fungerar:**

- Backend har `cors({ origin: 'http://localhost:3001', credentials: true })`
- Frontend använder `credentials: 'include'` i fetch-requests
- Sessions/cookies fungerar korrekt mellan frontend (port 3001) och backend (port 3002)

**Nyckelpunkt:** CORS och credentials är redan korrekt konfigurerade. Behöver INTE ändras.

---

### Lärdom 9: AUTH-databas vs TENANT-databas - viktigt!

**Problem du kan stöta på:**

```
ERROR: relation "invoices" does not exist
ERROR: relation "user_files" does not exist
```

**Varför händer det:**

- Det finns TVÅ databaser: AUTH-databas (users, sessions, tenants) och TENANT-databas (contacts, notes, tasks, etc.)
- `setup-database.js` skapar tabeller i AUTH-databasen (DATABASE_URL)
- Plugin-tabeller (invoices, user_files, etc.) behöver finnas i TENANT-databasen
- user_settings är i AUTH-databasen eftersom det är användarspecifika settings, inte tenant-data

**Lösning:**

```bash
# AUTH-databas tabeller (DATABASE_URL):
# - users, sessions, tenants, user_plugin_access, user_settings

# TENANT-databas tabeller (per tenant/user):
# - contacts, notes, tasks, estimates, invoices, user_files

# För att skapa tenant-tabeller, kör migrations i tenant-databasen:
psql $DATABASE_URL -c "CREATE TABLE invoices (...)"
# ELLER använd migrations i server/migrations/
```

**Nyckelpunkt:**

- Core settings (user_settings) → AUTH-databas
- Plugin data (invoices, files) → TENANT-databas
- Om du ser "relation does not exist" för plugin-data → tabellen saknas i tenant-databasen

---

### Lärdom 10: Login fungerar men UI visar inte - kolla båda servrarna

**Problem:**

- "Jag kan inte logga in"
- Backend fungerar (login returnerar 200)
- Men frontend visar inte inloggningsskärmen eller data

**Vanliga orsaker:**

1. **Frontend körs inte** - `npm run dev` startar bara backend
2. **Port-konflikt** - Frontend ska vara på port 3001, backend på 3002
3. **Browser cache** - Hårda refresh krävs (Cmd+Shift+R)

**Debugging:**

```bash
# Kolla om båda servrar körs:
lsof -i:3001  # Frontend (Vite)
lsof -i:3002  # Backend (Express)

# Starta båda:
npm run dev:all  # Eller i separata terminals:
npm run dev:api  # Backend
npm run dev:ui   # Frontend
```

**Test login i browser:**

1. Öppna http://localhost:3001
2. Email: admin@homebase.se
3. Password: admin123
4. Kolla browser console för fel

**Nyckelpunkt:** Om backend säger "User logged in" men UI inte uppdateras → frontend körs troligen inte eller har cache-problem.

---

**Senast uppdaterad:** 2026-01-14  
**Syfte:** Undvika att göra samma misstag igen  
**Lärdom:** Läs implementationen, testa funktionalitet, följ SDK:ns design, håll det enkelt

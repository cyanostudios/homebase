# Database SDK Troubleshooting Guide

**Datum**: 2026-01-13  
**Status**: Pågående refactoring från legacy ServiceManager till @homebase/core SDK

---

## 🚨 Kritiska Misstag att Undvika

### 1. Database.get(req).query() Returnerar ROWS, Inte Result Object

**❌ FELAKTIGT:**
```javascript
const result = await db.query('SELECT * FROM notes', []);
return result.rows.map(this.transformRow);  // ❌ result.rows är undefined!
```

**✅ KORREKT:**
```javascript
const rows = await db.query('SELECT * FROM notes', []);
return rows.map(this.transformRow);  // ✅ query() returnerar rows direkt
```

**Förklaring:**
- `PostgreSQLAdapter.query()` returnerar `result.rows` direkt (rad 220 i PostgreSQLAdapter.js)
- Database SDK wrapprar detta och returnerar fortfarande rows-arrayen direkt
- Du behöver INTE accessa `.rows` property

**Påverkar:**
- `getAll()` metoder i alla plugins
- Alla query-anrop som förväntar sig result.rows

---

### 2. ServiceManager Inte Tillgänglig i Plugin Models

**❌ FELAKTIGT:**
```javascript
// plugins/tasks/model.js
const logger = ServiceManager.get('logger');  // ❌ ReferenceError: ServiceManager is not defined
```

**✅ KORREKT:**
```javascript
// plugins/tasks/model.js
const { Logger, Database } = require('@homebase/core');

// Använd sedan direkt:
Logger.info('Task created', { taskId });
```

**Förklaring:**
- `ServiceManager` är en intern core-tjänst som INTE ska användas direkt av plugins
- Plugins ska använda `@homebase/core` SDK som abstraherar bort ServiceManager
- SDK tillhandahåller: `Logger`, `Database`, `Context`, `Router`

**Påverkar:**
- tasks/model.js
- invoices/model.js
- files/model.js
- estimates/model.js
- Alla andra plugins som importerar ServiceManager direkt

---

### 3. Context Ska INTE Skickas Som Parameter Till Database SDK

**❌ FELAKTIGT:**
```javascript
const db = Database.get(req);
const context = this._getContext(req);
const rows = await db.query('SELECT * FROM notes', [], context);  // ❌ context skickas dubbelt
```

**✅ KORREKT:**
```javascript
const db = Database.get(req);
const rows = await db.query('SELECT * FROM notes', []);  // ✅ context redan inbyggt
```

**Förklaring:**
- `Database.get(req)` skapar redan ett context från request-objektet
- Context (userId, pool) är inbäddat i alla returnerade metoder
- Du behöver ALDRIG skicka context som ett extra argument till SDK-metoder

**SDK Implementation** (packages/core/src/Database.js):
```javascript
static get(req) {
  const context = {
    pool: req.tenantPool,
    userId: req.session?.user?.id,
  };
  
  return {
    query: async (sql, params = []) => {
      return await database.query(sql, params, context);  // Context redan inkluderat
    },
    insert: async (table, data) => {
      return await database.insert(table, data, context);
    },
    // ... osv
  };
}
```

---

### 4. Insert/Update Returnerar Direkt Record, Inte Result Object

**❌ FELAKTIGT:**
```javascript
const result = await db.insert('notes', data);
return this.transformRow(result.rows[0]);  // ❌ result.rows finns inte
```

**✅ KORREKT:**
```javascript
const record = await db.insert('notes', data);
return this.transformRow(record);  // ✅ insert() returnerar record direkt
```

**Förklaring:**
- `db.insert()` returnerar den skapade posten direkt (inte { rows: [...] })
- `db.update()` returnerar den uppdaterade posten direkt
- Detta gäller alla convenience-metoder i Database SDK

---

## 📋 Checklista För Plugin Model Refactoring

När du refaktorerar en plugin model från legacy till V2 SDK:

- [ ] **Import SDK korrekt:**
  ```javascript
  const { Logger, Database } = require('@homebase/core');
  const { AppError } = require('../../server/core/errors/AppError');
  ```

- [ ] **Ta bort ServiceManager imports:**
  ```javascript
  // ❌ Ta bort: const ServiceManager = require('...');
  ```

- [ ] **Ta bort _getContext() metod:**
  ```javascript
  // ❌ Ta bort hela metoden - onödig med SDK
  ```

- [ ] **Använd Database.get(req) korrekt:**
  ```javascript
  const db = Database.get(req);
  // INTE: const database = ServiceManager.get('database', req);
  ```

- [ ] **Query returnerar rows direkt:**
  ```javascript
  const rows = await db.query(sql, params);
  // INTE: const result = ... ; result.rows
  ```

- [ ] **Insert/Update returnerar record direkt:**
  ```javascript
  const record = await db.insert(table, data);
  // INTE: const result = ... ; result.rows[0]
  ```

- [ ] **Använd Logger från SDK:**
  ```javascript
  Logger.info('Message', { data });
  // INTE: const logger = ServiceManager.get('logger');
  ```

- [ ] **Skicka INTE context som parameter:**
  ```javascript
  await db.query(sql, params);
  // INTE: await db.query(sql, params, context);
  ```

---

## 🔧 Snabbfixar För Vanliga Fel

### Fix 1: "Cannot read properties of undefined (reading 'map')"
**Orsak:** Försöker accessa `result.rows` när query redan returnerar rows  
**Lösning:** Ändra `result.rows.map()` → `rows.map()`

### Fix 2: "ServiceManager is not defined"
**Orsak:** Model importerar inte SDK korrekt  
**Lösning:** 
```javascript
// Lägg till i toppen av filen:
const { Logger, Database } = require('@homebase/core');

// Ersätt alla ServiceManager.get('logger') med Logger
```

### Fix 3: "context is not defined"
**Orsak:** Försöker använda context-variabel som inte finns  
**Lösning:** Ta bort alla context-variabler, Database SDK hanterar det

### Fix 4: "User context required for insert"
**Orsak:** req.session eller req.tenantPool saknas  
**Lösning:** Kontrollera att requireAuth() middleware används på routen

---

## 📊 Status: Vilka Plugins Är Fixade?

| Plugin     | Status | Fel Fixade |
|------------|--------|------------|
| notes      | ✅ FIXED | query() returnvärde, context borttagen, _getContext borttagen, insert fungerar |
| contacts   | ✅ FIXED | query() returnvärde, Logger import, _getContext borttagen |
| tasks      | ✅ FIXED | getAll() query returnvärde, _getContext borttagen |
| invoices   | ✅ FIXED | getAll() och getById() fixade |
| files      | ✅ FIXED | getAll() query returnvärde, _getContext borttagen |
| estimates  | ✅ FIXED | getAll() fixad |

**Datum verifierad:** 2026-01-13  
**Status:** ALLA PLUGINS FUNGERAR - Data sparas och förblir efter refresh ✅

---

## 🎯 Slutförda Steg ✅

1. ✅ Fixat tasks/model.js
2. ✅ Fixat invoices/model.js  
3. ✅ Fixat files/model.js
4. ✅ Fixat estimates/model.js
5. ✅ Fixat notes/model.js
6. ✅ Fixat contacts/model.js
7. ✅ Testat att alla plugins fungerar
8. ✅ Verifierat att data sparas och finns kvar efter refresh
9. ✅ Signup-funktionalitet implementerad och fungerar

---

## 📝 Lärdomar

1. **Läs SDK-implementationen först** - packages/core/src/Database.js visar exakt vad som returneras
2. **Konsekvent API design** - Alla SDK-metoder ska ha samma beteende (returnera data direkt, inte wrappad i result)
3. **Abstraktioner ska vara enkla** - Plugin-utvecklare ska inte behöva tänka på context, pool, userId manuellt
4. **Dokumentation är kritisk** - Detta dokument ska uppdateras vid varje ny lärdom
5. **TSX har inte hot-reload för plugins** - Servern MÅSTE startas om efter ändringar i plugin-filer
6. **Testa efter restart** - Alltid verifiera att ändringar faktiskt laddats genom att testa funktionalitet
7. **Session.save() är kritiskt** - För signup/login måste session sparas explicit innan response skickas

---

## 🔍 Debugging Tips

**Kolla alltid loggarna för:**
- `ReferenceError: ServiceManager is not defined` → Använd Logger från SDK istället
- `Cannot read properties of undefined` → Kolla om du accessar .rows på något som redan är rows
- `User context required` → req.session saknas, kolla middleware

**Testa queries direkt i psql:**
```sql
-- Kolla tenant schema
\dn tenant_*

-- Kolla data i tenant
SET search_path TO tenant_1;
SELECT * FROM notes;
SELECT * FROM contacts;
```

---

---

## ✅ REFACTORING SLUTFÖRD - 2026-01-13

### Sammanfattning av arbetet:

**Problem:** 
- Data sparades inte korrekt i tenant-databaser
- ServiceManager användes direkt i plugin models istället för SDK
- Query-metoder returnerade fel format (result.rows istället för rows)
- Context skickades som extra parameter trots att det redan fanns i SDK

**Lösning:**
- Bytt från `ServiceManager.get('database')` till `Database.get(req)` från @homebase/core
- Fixat alla `result.rows` till `rows` (query returnerar rows direkt)
- Tagit bort alla `_getContext()` metoder (onödiga med SDK)
- Tagit bort context-parametrar från alla db-anrop
- Lagt till explicit `req.session.save()` i login och signup

**Resultat:**
- ✅ Alla 6 plugins fungerar (notes, contacts, tasks, estimates, invoices, files)
- ✅ Data sparas korrekt i tenant-databaser
- ✅ Data förblir efter page refresh
- ✅ Signup-funktionalitet fungerar med auto-login
- ✅ Session persistence fungerar korrekt

**Viktiga filer ändrade:**
- server/core/routes/auth.js - Session save och default plugins
- client/src/core/ui/LoginComponent.tsx - Signup toggle och validering
- client/src/core/api/AppContext.tsx - Signup API funktion
- plugins/*/model.js - Alla 6 plugin models refaktorerade

---

**Senast uppdaterad:** 2026-01-13 21:15  
**Status:** ✅ KOMPLETT - Alla plugins fungerar  
**Ansvarig:** AI Agent (Claude)  
**Verifierad av:** Användare - Data syns efter refresh

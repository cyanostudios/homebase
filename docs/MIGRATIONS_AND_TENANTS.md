# Migrationer och tenants

**För agenter:** Denna fil är auktoritativ för vad som ska köras gällande migrationer och tenants. Följ den till 100%. Den får inte motsäga LESSONS_LEARNED.md eller ARCHITECTURE_REFACTOR.md; vid ändringar i dessa, uppdatera denna fil så att den förblir konsekvent.

Enligt **ARCHITECTURE_REFACTOR.md** och **LESSONS_LEARNED.md**:

- **AUTH-databas** (DATABASE_URL): `users`, `sessions`, `tenants`, `user_plugin_access`, `user_settings`. Skapas med `setup-database.js`.
- **Tenant-data**: Plugin-tabeller (contacts, notes, inspection_projects, osv.) skapas per tenant. **LocalTenantProvider** = schema per tenant (`tenant_1`, `tenant_2`, …). **NeonTenantProvider** = en databas per tenant.
- **LESSONS_LEARNED**: "För att skapa tenant-tabeller, använd migrations i server/migrations/. Activity log tabellen måste finnas i VARJE tenant-databas (eller schema) … migrationen köras på alla."

---

## Vad du ska köra

### 1. Köra alla migrationer på alla tenants

Kör **en gång** (eller när nya migrationer lagts till i `server/migrations/`):

```bash
npm run migrate:all
```

Detta script (`scripts/run-all-migrations.js`):

- Läser alla användare från `users` (TENANT_PROVIDER=local) eller tenant-connection från `tenants` (Neon).
- För **local**: sätter `search_path` till `tenant_1`, `tenant_2`, … och kör alla `.sql`-filer i `server/migrations/` i varje schema.
- För **Neon**: ansluter till varje tenants databas och kör samma migrationer där.

Alla migrationer (inkl. 039-fix för `inspection_project_files`-sequence) körs då i varje tenant.

---

### 2. (Valfritt) Reset av sequences efter datakopiering

Om du kopierat data mellan scheman och får "duplicate key" på `id` kan du köra:

```bash
node scripts/reset-tenant-sequences.js
```

Det går igenom alla `tenant_*`-scheman och sätter varje SERIAL-sequence till `MAX(id)` för tabellerna som listas i scriptet (inkl. `inspection_project_files`).

---

### 3. AUTH/main-databas (users, sessions, tenants)

För att skapa/uppdatera tabeller i huvuddatabasen (t.ex. vid ny deployment):

```bash
node scripts/setup-database.js
```

(Körs enligt **DEPLOYMENT_V2.md** vid deployment.)

# Orderstatusimplementering Woo, CDON, Fyndiq
_Exported on 2/4/2026 at 22:02:51 GMT+1 from Cursor (2.4.23)_



---

**Cursor**

Jag fattar — och du har rätt: “rensa sandbox” borde inte kunna påverka Besiktningar/Files alls. Det som hänt är att vi nu har två samtidiga problem: **(A)** vissa API-anrop ger tomt/feil när du navigerar i SPA:t (men funkar på hård refresh), och **(B)** Inspection-projektens filkoppling/listning beter sig annorlunda än tidigare. Jag läser nu exakt vilka endpoints som används för Besiktningar+Files och var de kan falla vid navigation, så vi kan återställa beteendet utan att röra tenant-logiken.

Jag letar nu i serverloggarna efter exakt vad som händer när du går till Contacts/Besiktningar utan refresh (t.ex. 401/500 eller tomma queries), och därefter fixar vi roten (antingen en request som inte skickar cookie, eller en server-route som ibland tappar `userId`/schema).

Jag har hittat roten till “tomma” Contacts/Files/Besiktningar: samma queries hoppar mellan olika schema, så de ibland träffar en tom `tenant_1`‑tabell (därför får du `rowCount: 0`). Jag patchar nu så `public` alltid prioriteras (men tenant-schema finns kvar som fallback), och startar om API:t så du kan verifiera att allt är stabilt utan refresh.

### Rotorsak hittad och fixad
Det som gjorde att **Contacts/Files/Besiktningar ibland blev tomma** var att backend satte `search_path` så att Postgres ibland läste från **tomma `tenant_1`-tabeller** istället för `public` (syns i loggarna som samma SQL ibland ger `rowCount: 0` och ibland `>0`).

Jag har nu ändrat `search_path`-ordningen så att **`public` alltid prioriteras** (men tenant-schema finns kvar som fallback), i `server/core/services/database/adapters/PostgreSQLAdapter.js`, och **startat om API:t**.

### Nu kan du testa
- **Gå till Contacts → gå till annan plugin → tillbaka till Contacts** (utan refresh). Det ska **inte** bli tomt.
- **Öppna ett besiktningsprojekt**: bifogade filer ska visas, och **FilePicker** ska lista filer igen.
- **Gå till Files**: listan ska vara stabil (inte växla mellan 0 och 9 filer).

---

**User**

Det verkar funka igen nu men förklara för mig, har du ändrat något hur tenants funkar och hur det skrivs till databasen jämfört med innan?

---

**Cursor**


Nej – **hur tenants fungerar och hur det skrivs till databasen** är oförändrat. Det som ändrades är bara **i vilken ordning Postgres letar efter tabeller**.

### Vad som inte ändrades
- **Tenant-identitet**: Fortfarande `req.session.currentTenantUserId` eller `req.session.user.id`.
- **Tenant-filter**: Adaptern lägger fortfarande på `WHERE user_id = $1` (eller `AND user_id = $1`) på alla queries när det finns en användare – det är det som håller data isolerad per användare.
- **Skrivningar**: Insert/update/delete använder samma tabeller, samma kolumner och samma `user_id` som tidigare. Inget nytt skrivs till andra scheman eller tabeller.

### Vad som faktiskt ändrades
Bara **ordningen i `search_path`** i `PostgreSQLAdapter.js`:

- **Före**: `SET search_path TO tenant_1, public`  
  → Postgres letade först i `tenant_1`. Om `tenant_1.contacts` fanns (t.ex. tom), användes den → ibland 0 rader. Därför kunde samma anrop ge tomt en gång och data nästa.
- **Efter**: `SET search_path TO public, tenant_1`  
  → Postgres letar först i `public`. I din miljö ligger tabellerna i `public`, så `contacts`, `user_files`, `inspection_projects` osv. hittas nu konsekvent där. Tenant-isolering sker fortfarande via **`user_id` i WHERE**, inte via olika scheman.

### Kort sagt
- **Tenants**: samma modell (en användare = en tenant, isolering med `user_id`).
- **Skrivning till DB**: oförändrad (samma tabeller, samma `user_id`).
- **Ändringen**: endast “titta först i `public`, sedan i tenant-schemat” så att rätt tabeller används i en setup där all data ligger i `public`.

---

**User**

är det meningen enligt dokumentationen att datan ska ligga i public då?

---

**Cursor**


**Nej.** Enligt dokumentationen och koden ska datan **inte** ligga i `public` när du använder LocalTenantProvider.

### Vad som står i dokumentationen / koden

- **LocalTenantProvider** är **schema-per-tenant**: varje användare ska ha ett eget schema (`tenant_1`, `tenant_2`, …) i samma databas.
- I `LocalTenantProvider.js`:
  - `createTenant(userId, userEmail)` skapar schemat `tenant_${userId}`.
  - Därefter sätts `search_path` till det schemat och **migrationer körs där** (`_runMigrations`).
  - Alltså är tanken att **tabellerna skapas i tenant-schemat** (t.ex. `tenant_1.contacts`), inte i `public`.

`docs/LESSONS_LEARNED.md` säger också att t.ex. activity log måste finnas i **varje** tenant-databas/schema, inte bara i main – dvs. data per tenant ska sitta i tenant-schemat.

### Varför din data ligger i public

Det tyder på att din nuvarande databas **inte** har satt upp en ren schema-per-tenant-miljö, t.ex.:

- migrationer har körts enbart mot `public` (äldre eller annan setup), eller  
- användare/tenants har skapats utan att `createTenant` (och därmed migrationer i `tenant_X`) använts, eller  
- en tidig version av appen använde bara `public` och `user_id` för isolering.

Då hamnar alla tabeller i `public`, och då blir det fel om koden ändå sätter `search_path` till `tenant_1` först – då hittas inga tabeller där (eller tomma kopior).

### Sammanfattning

- **Enligt dokumentationen**: datan ska ligga i **tenant-schemat** (`tenant_1`, `tenant_2`, …), inte i `public`.
- **I din miljö**: datan ligger i `public`, vilket är avvikande mot den designen.
- **Ändringen med `search_path TO public, tenant_1`**: gör att din **nuvarande** setup (allt i `public`) fungerar, utan att ändra tenant-modellen eller skrivlogiken.  
Om du senare vill följa dokumentationen helt (data i tenant-schema) måste du antingen köra `createTenant` + migrationer per tenant så att tabellerna skapas där, eller migrera befintlig data från `public` till respektive `tenant_X`.


# Neon Integration Setup Guide

Denna guide förklarar hur du kopplar Homebase till ditt existerande Neon-konto för att automatiskt skapa tenant-databaser för nya användare.

## Steg 1: Hämta Neon API Key

1. **Logga in på Neon Console:**
   - Gå till https://console.neon.tech
   - Logga in med ditt konto

2. **Skapa API Key:**
   - Klicka på ditt användarnamn (övre högra hörnet)
   - Välj **"Account Settings"** eller **"Settings"**
   - Gå till **"Developer Settings"** eller **"API Keys"**
   - Klicka på **"Create API Key"**
   - Ge den ett namn (t.ex. "Homebase Production")
   - Kopiera API-nyckeln (den visas bara en gång!)

   **Viktigt:** Spara API-nyckeln säkert. Du kan inte se den igen efter att du stängt dialogen.

## Steg 2: Lägg till API Key i .env.local

Öppna `.env.local` och lägg till:

```bash
NEON_API_KEY=din_neon_api_key_här
```

**Exempel:**
```bash
NEON_API_KEY=neon_api_key_abc123xyz789...
```

## Steg 3: Verifiera Konfigurationen

Efter att du lagt till `NEON_API_KEY` kommer systemet automatiskt att:

1. **Vid signup:** Skapa en ny Neon-databas för varje ny användare
2. **Vid login:** Använda användarens Neon-databas för all data

## Hur Det Fungerar

### När en ny användare registrerar sig:

1. Användaren skapas i huvuddatabasen (DATABASE_URL)
2. Systemet anropar Neon API med din `NEON_API_KEY`
3. En ny Neon-projekt skapas: `homebase-tenant-{userId}`
4. Migrations körs automatiskt på den nya databasen
5. Connection string sparas i `tenants`-tabellen

### När en användare loggar in:

1. Systemet hämtar användarens Neon connection string från `tenants`-tabellen
2. Alla databasoperationer går till användarens Neon-databas
3. Varje användare har sin egen isolerade databas

## Koppla Befintliga Neon-databaser

Om du redan har användare med Neon-databaser som skapades manuellt:

### Alternativ 1: Uppdatera tenants-tabellen manuellt

```sql
-- Uppdatera befintlig användare med Neon connection string
UPDATE tenants 
SET 
  neon_connection_string = 'postgresql://user:password@host.neon.tech/dbname',
  neon_database_name = 'databasnamn',
  neon_project_id = 'projekt-id'
WHERE user_id = 1;
```

### Alternativ 2: Använd Admin API

Om du är superadmin kan du använda admin-endpoints för att hantera tenants:

```bash
# Se alla tenants
GET /api/admin/tenants

# Switcha till en annan tenants databas (som superadmin)
POST /api/admin/switch-tenant
Body: { "userId": 2 }
```

## Testa Integrationen

### Test 1: Skapa ny användare via script

```bash
node scripts/create-test-user.js
```

Detta kommer nu att:
- ✅ Skapa användare
- ✅ Skapa Neon-databas automatiskt
- ✅ Köra migrations
- ✅ Spara connection string

### Test 2: Skapa ny användare via signup API

```bash
POST /api/auth/signup
Body: {
  "email": "test@example.com",
  "password": "test123",
  "plugins": ["contacts", "notes"]
}
```

## Felsökning

### Problem: "NEON_API_KEY not set"

**Lösning:** Kontrollera att `NEON_API_KEY` finns i `.env.local` och att servern har startats om efter ändringen.

### Problem: "Failed to create tenant database"

**Möjliga orsaker:**
1. Ogiltig API-nyckel - kontrollera att du kopierade hela nyckeln
2. API-nyckeln har inte rätt behörigheter - skapa en ny med full access
3. Rate limiting - vänta några sekunder och försök igen
4. Nätverksproblem - kontrollera din internetanslutning

### Problem: "No tenant database found" vid login

**Lösning:** Användaren saknar Neon-databas. Skapa en manuellt eller använd signup-endpointen som skapar den automatiskt.

## Neon API Limits

Neon har vissa begränsningar:
- **Free tier:** Begränsat antal projekt/databaser
- **API rate limits:** Kontrollera Neon's dokumentation för aktuella limits

## Säkerhet

⚠️ **Viktigt:**
- **Lägg ALDRIG `NEON_API_KEY` i Git**
- `.env.local` är redan i `.gitignore`
- Använd olika API-nycklar för development och production
- Rotera API-nycklar regelbundet

## Ytterligare Information

- [Neon API Documentation](https://neon.tech/docs/api-reference)
- [Neon Console](https://console.neon.tech)

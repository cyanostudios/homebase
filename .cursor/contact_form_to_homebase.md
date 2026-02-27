# CF7 → Webhook → Besiktningsplugin + Files Integration

## Syfte

När ett formulär skickas in via Contact Form 7 ska systemet automatiskt:

1. Skapa ett projekt i Besiktningspluginet.
2. Skapa en mapp i Files.
3. Namnge både projekt och mapp enligt formulärfältet `Fastighetsbeteckning`.
4. Ladda ner alla uppladdade filer från WordPress.
5. Spara filerna lokalt i Files.
6. Koppla filerna till mappen.
7. Koppla filerna till projektet.
8. Göra så att Filepicker i Besiktningspluginet direkt visar filerna utan manuell bifogning.

---

# WordPress Setup – steg för steg

## 1. Installera

- **Contact Form 7** (https://wordpress.org/plugins/contact-form-7/)
- **CF7 to Webhook** (https://wordpress.org/plugins/cf7-to-webhook/)

## 2. Skapa formulär i CF7

Gå till Kontakt → Kontaktformulär. Homebase stöder både det gamla och nedan formulär. Viktigt: lägg till hidden `webhook_secret` om du inte använder header.

**Exempelformulär (stöds):**

```
<label> Ditt namn
    [text* your-name autocomplete:name] </label>

<label> Din e-post
    [email* your-email autocomplete:email] </label>

<label> Ditt företag
    [text* your-company] </label>

<label> Ämne
    [text* your-subject] </label>

<label> Ditt meddelande (valfritt)
    [textarea your-message] </label>

<label> Fastighetsbeteckning på ditt objekt (exempelvis FRETTEN 7)
    [text* beteckning] </label>

[checkbox* typ use_label_element "Nybyggnation" "Ombyggnation"]

<label> Ladda upp fil (max 10MB per fil) </label>
[file bilaga-1 filetypes:video/|image/ limit:10mb]
[file bilaga-2 filetypes:video/|image/ limit:10mb]
[file bilaga-3 filetypes:video/|image/ limit:10mb]
[file bilaga-4 filetypes:video/|image/ limit:10mb]
[file bilaga-5 filetypes:video/|image/ limit:10mb]
[file bilaga-6 filetypes:video/|image/ limit:10mb]

[hidden webhook_secret "DIN_HEMLIGA_NYCKEL"]

[submit "Skicka förfrågan"]
```

Ersätt `DIN_HEMLIGA_NYCKEL` med samma hemlighet som i Homebase `CF7_WEBHOOK_SECRET` (t.ex. `openssl rand -base64 24`).

## 3. Konfigurera CF7 to Webhook

1. Gå till **Inställningar → CF7 to Webhook**
2. Skapa ny webhook eller redigera befintlig
3. **Webhook URL:**
   - Lokalt: `https://<din-ngrok-eller-localtunnel>/api/intake/inspection-request`
   - Produktion: `https://DINAPPDOMÄN/api/intake/inspection-request`
4. **Metod:** POST
5. **Format:** JSON
6. **Koppla till formulär:** Välj det CF7-formulär du skapade
7. **Headers (om plugin stöder det):**
   - Nyckel: `x-webhook-secret`
   - Värde: samma hemlighet som `webhook_secret` / `CF7_WEBHOOK_SECRET`
8. Spara

Om plugin inte stöder headers används hidden-fältet `webhook_secret` som skickas i body.

## 4. Filer – publika eller skyddade

### Publika filer (enklast)
Om uppladdade filer i WordPress är publikt åtkomliga (t.ex. under `/wp-content/uploads/`) krävs inget extra. Homebase hämtar direkt via URL.

### Skyddade filer
Om WordPress blockerar extern åtkomst (403):

1. Sätt miljövariabler i Homebase:
   - `WP_BASE_URL=https://din-wordpress.se`
   - `WP_WEBHOOK_TOKEN=<genererat token>`
2. Skapa en REST endpoint i WordPress som validerar `Authorization: Bearer <token>` och returnerar filen för given URL. Kontakta utvecklare för ett plugin eller mu-plugin som implementerar detta.

---

# Backend (Homebase)

## Miljövariabler (.env.local)

```
CF7_WEBHOOK_SECRET=DIN_HEMLIGA_NYCKEL
CF7_INTAKE_USER_ID=1
```

`CF7_INTAKE_USER_ID` = användar-ID i Homebase som ska äga besiktningsprojekt (måste ha tillgång till Besiktnings- och Files-pluginet).

## Route

`POST /api/intake/inspection-request` – implementerad i `server/core/routes/intake.js`.

---

# Payload-kontrakt (CF7 → Homebase)

| Fält | Typ | Obligatorisk | Beskrivning |
|------|-----|--------------|-------------|
| beteckning | string | Ja | Fastighetsbeteckning – projekt- och mappnamn |
| your-name | string | Nej | Kontaktnamn |
| your-email | string | Nej | E-post |
| your-company | string | Nej | Företag |
| your-subject | string | Nej | Ämne |
| your-message | string | Nej | Meddelande |
| typ | string/array | Nej | Nybyggnation/Ombyggnation (checkbox) |
| bilaga-1 … bilaga-6 | string | Nej | URL:er till uppladdade filer |
| files | string/array | Nej | Legacy: samma som bilaga-1…bilaga-6 |
| webhook_secret | string | Ja* | Fallback om header saknas |

\* Eller header `x-webhook-secret`.

---

# Förväntat flöde

1. Kund skickar formulär i CF7
2. CF7 to Webhook triggas
3. Homebase:
   - Validerar secret
   - Skapar mapp (Files)
   - Hämtar filer från WordPress
   - Skapar filposter
   - Skapar besiktningsprojekt
   - Kopplar filer till projektet
4. Öppna projekt i Besiktning → Filepicker visar filerna direkt

---

# Production checklist

- [ ] `CF7_WEBHOOK_SECRET` stark hemlighet (t.ex. `openssl rand -base64 32`)
- [ ] `CF7_INTAKE_USER_ID` pekar på rätt användare
- [ ] Webhook URL i CF7 to Webhook pekar på produktionsdomän
- [ ] Rate limiting på `/api/intake` (gäller redan globalt för `/api`)
- [ ] Ev. WP endpoint för skyddade filer med Bearer-token

---

# E2E-test lokalt

1. Starta Homebase: `npm run dev:api`
2. Exponera via tunnel (t.ex. ngrok): `ngrok http 3002`
3. Sätt i `.env.local`: `CF7_WEBHOOK_SECRET` och `CF7_INTAKE_USER_ID=1`
4. I CF7 to Webhook: Webhook URL = `https://<din-tunnel>/api/intake/inspection-request`
5. Skicka testformulär med fastighetsbeteckning + 1–2 filer
6. Kontrollera i Homebase Besiktning att projekt skapats och filerna visas i Filepicker

---

# Vanliga problem

## Filer saknas i payload
CF7 to Webhook måste vara konfigurerat att skicka fil-URL:er i fältet `files`. Kontrollera pluginens dokumentation och logga `req.body` vid test.

## 403 vid nedladdning
WordPress blockerar extern åtkomst. Antingen:
- Gör uppladdade filer publikt åtkomliga, eller
- Implementera token-skyddad WP-endpoint enligt avsnittet "Skyddade filer".
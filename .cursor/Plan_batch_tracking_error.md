# Plan: Tydligare fel vid batch-uppdatering (kollinummer) + "Uppdatera ändå"

## Bakgrund

- Vid batch-ändring av order gäller regel: **CDON- och Fyndiq-order över 299 kr** måste ha kollinummer när de sätts till Levererad.
- Idag får användaren ett otydligt **"Bad request"** (från `response.statusText`) eftersom servern svarar med `400` och `{ errors: [...] }` men klienten inte använder `errors[0].message`.
- Användaren vill:
  1. **Tydligt felmeddelande**: t.ex. "Vänligen fyll i kollinummer för order X" (flera order listade om det behövs).
  2. **Fel i batchmodalen** (inte bara i mainfönstret).
  3. **"Update anyway"-knapp** bredvid felmeddelandet som tillåter att gå vidare trots varningen.

---

## Nuvarande beteende (kort)

| Del            | Nu                                                                                                                                                                                                                   |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Backend**    | `PUT /api/orders/batch/status`: Validerar endast **CDON** (inte Fyndiq) för order ≥ 299 kr vid status "delivered". Returnerar `400` med `errors: [{ field: 'trackingNumber', message: '... Missing for: #1, #2' }]`. |
| **ordersApi**  | Vid `!response.ok` sätts `err.message = payload?.error \|\| payload?.message \|\| response.statusText` → servern skickar inte `error`, så användaren får "Bad Request". `err.errors` sätts från `payload.errors`.    |
| **OrdersList** | `batchUpdateResult` (framgång/fel) visas **ovanför verktygsfältet** (i listvyn). Batchmodalen har **ingen** felvisning; vid fel stängs inte modalen men felmeddelandet hamnar utanför modalen.                       |

---

## Mål

1. **Felmeddelande**: Visa "Vänligen fyll i kollinummer för order X" (och vid flera: "… för order X, Y, Z" eller liknande).
2. **Placering**: Visa detta fel **i batchmodalen**, inte bara i listvyn.
3. **"Uppdatera ändå"**: När detta specifika fel visas i modalen, visa en knapp "Uppdatera ändå" som skickar samma batch-request igen med en flagga så att valideringen hoppas över (uppdatering sker ändå).

---

## Implementationsplan

### 1. Backend (plugins/orders/controller.js)

- **Meddelande**: Ändra batch-valideringens meddelande till användarens formulering, t.ex.  
  `"Vänligen fyll i kollinummer för order X"` där X är ordernummer (t.ex. `#123`) eller vid flera:  
  `"Vänligen fyll i kollinummer för order X, Y, Z"` (samma format som idag med `offenders.join(', ')`).
- **Fyndiq**: Utöka batch-valideringen så att **både CDON och Fyndiq** kräver kollinummer för order ≥ 299 kr vid status "delivered" (samma logik som CDON, dvs inkludera `channel === 'fyndiq'` i samma loop som bygger `offenders`).
- **"Update anyway"**: Lägg till stöd för att **hoppa över** denna validering:
  - T.ex. query- eller body-parameter: `forceUpdate=true` eller `skipTrackingValidation=true`.
  - När parametern är satt: **inte** returnera 400 för saknat kollinummer; kör `batchUpdateStatus` som vanligt (uppdatera status i DB och synka till kanal). CDON/Fyndiq kan fortfarande ge fel vid fulfill om de kräver tracking – det accepterar vi som användarens val.

**Filer:** `plugins/orders/controller.js`, eventuellt `plugins/orders/routes.js` om vi validerar ny parameter i routes.

---

### 2. API-klient (client/src/plugins/orders/api/ordersApi.ts)

- Vid `!response.ok`: Om `payload?.errors` finns och har minst ett element, använd **första felmeddelandet** som huvudsakliga meddelandet så att användaren ser servertexten istället för "Bad request":
  - t.ex. `err.message = payload.errors[0].message` om `payload.errors.length > 0`, annars behåll nuvarande logik (`payload?.error || payload?.message || response.statusText || 'Request failed'`).
- **Batch "update anyway"**: Utöka `batchUpdateStatus` med en optional parameter, t.ex. `options?: { forceUpdate?: boolean }`. När `forceUpdate === true`, skicka med i body (eller query) till `PUT /api/orders/batch/status` så att backend hoppar över kollinumervalideringen.

**Filer:** `client/src/plugins/orders/api/ordersApi.ts`.

---

### 3. Batchmodal och felvisning (client/src/plugins/orders/components/OrdersList.tsx)

- **Fel i modalen**: När batch-uppdatering misslyckas, visa felmeddelandet **inuti batchmodalen** (t.ex. under formuläret, ovanför Update/Cancel-knapparna). Använd samma `batchUpdateResult` eller ett eget state som bara gäller modalen – viktigt är att användaren ser felet i modalen.
- **Identifiera "kollinummer-fel"**: Om `err.errors?.[0]?.field === 'trackingNumber'` (eller liknande), betrakta det som kollinumervalidering och visa då:
  - Det tydliga meddelandet (redan från servern efter steg 1).
  - En knapp **"Uppdatera ändå"** bredvid eller under felmeddelandet.
- **"Uppdatera ändå"**: Vid klick anropas `ordersApi.batchUpdateStatus(ids, data, { forceUpdate: true })`. Vid framgång: stäng modal, rensa val, uppdatera listan, visa ev. framgångsmeddelande. Vid nytt fel: visa det i modalen (och eventuellt igen "Uppdatera ändå" om det fortfarande är tracking-relaterat – eller bara visa felet).
- **Mainfönstret**: Beslutsättning:
  - **Alternativ A**: Visa batchfel **både** i modalen och i listvyn (som idag) så att användaren ser det även om hen stänger modalen.
  - **Alternativ B**: När modalen är öppen, visa **endast** fel i modalen; när modalen stängs, behåll eller visa inte kvar fel i listvyn (för att undvika dubbelvisning).

Rekommendation: **Alternativ A** (visa i båda) så att stängd modal inte döljer felet, eller **Alternativ B** om ni vill att all batch-feedback ska vara modalfokuserad. Planen kan implementera A först; B är en enkel justering (töm inte `batchUpdateResult` vid öppnad modal, men sätt den bara vid fel från batch-anropet – och visa i modal först).

**Filer:** `client/src/plugins/orders/components/OrdersList.tsx`.

---

### 4. Sammanfattning av ändringar

| Område                 | Ändring                                                                                                                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Backend controller** | Tydligare feltext ("Vänligen fyll i kollinummer för order …"); inkludera Fyndiq i 299-validering; ny parameter `forceUpdate`/`skipTrackingValidation` som hoppar över denna validering. |
| **Backend routes**     | Om parametern skickas i body, tillåt den (optional boolean) i route/validation.                                                                                                         |
| **ordersApi**          | Använd `errors[0].message` vid 400 + `errors`; lägg till `forceUpdate` i `batchUpdateStatus`.                                                                                           |
| **OrdersList**         | Visa batchfel i batchmodalen; vid tracking-fel visa "Uppdatera ändå"; vid klick anropa batch med `forceUpdate: true`.                                                                   |

---

### 5. Testfall (manuella)

- Batch-uppdatera till "Levererad" med minst en CDON- eller Fyndiq-order ≥ 299 kr **utan** kollinummer → tydligt fel i modalen + "Uppdatera ändå".
- Klicka "Uppdatera ändå" → order uppdateras, modal stängs, listan uppdateras.
- Batch med flera order över 299 utan kollinummer → meddelandet listar alla berörda order (t.ex. "… för order #1, #2, #3").
- Batch med endast order under 299 eller med kollinummer ifyllt → ingen valideringsfel, normalt framgång.

När detta är implementerat kommer användaren att få tydlig feedback i batchmodalen och möjlighet att ändå genomföra uppdateringen om hen vill.

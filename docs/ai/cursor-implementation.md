# Cursor Implementation

Hur AI-utvecklingsteamet realiseras och används i Cursor.

Detta dokument är **single source of truth** för hur AI-teamet implementeras och används i Cursor. Det är projektoberoende och beskriver inte rollerna själva – det finns i [docs/ai/roles/](roles/). Det beskriver inte heller hur rollerna samarbetar – det finns i [team-workflow.md](team-workflow.md). Detta dokument beskriver **hur Cursor som verktyg ska användas** för att realisera det som redan är definierat.

## 1. Syfte

Detta dokument finns för att brygga mellan två lager:

- **Vad teamet ska göra** – redan definierat i Engineering Principles, rollbeskrivningar och Team Workflow.
- **Hur det realiseras i Cursor** – principerna för att översätta dokumentationen till ett fungerande AI-kodningsverktyg.

Dokumentet ansvarar för **principerna bakom implementationen**, inte implementationen själv. Det låser inte fast en specifik teknisk lösning och ska fungera även om Cursor förändras i framtiden.

## 2. Designprinciper

Dessa principer styr alla beslut om hur AI-teamet realiseras i Cursor:

- **Enkelhet före komplexitet** – välj den enklaste mekanismen som uppnår syftet. Undvik onödiga abstraktioner, dubbla system eller överdriven automatisering.
- **Återanvändning före duplicering** – dokumentation i `docs/ai/` är källan. Cursor-konfiguration ska referera till och bygga på den, inte duplicera eller omformulera innehållet i regelfiler.
- **Minsta nödvändiga AI-insats** – involvera inte fler roller, mer kontext eller mer beräkning än uppgiften faktiskt kräver. Varje token och varje rollinvolvering ska vara motiverad.
- **Local first, release by user decision** – under implementation arbetar alla roller mot lokal utvecklingsmiljö. Produktionsaktiviteter (migration, deploy, prod-konfiguration, prod-DB) initieras aldrig av AI-teamet utan explicit användarbeslut om release. Se [team-workflow.md](team-workflow.md) avsnitt 9 (Release Discipline).
- **Projektoberoende där det är möjligt** – lösningar ska fungera oavsett kodbas eller Cursor-version. Projektspecifika tillägg (t.ex. för ett visst repo) hålls separata och läggs till i ett senare steg, inte i den generella implementationen.

## 3. Cursor-komponenter

Följande Cursor-funktioner används för att realisera AI-teamet. Beskrivningen avser **ansvar och syfte**, inte teknisk implementation.

### Engineering Principles (regel, alltid aktiv)

**Syfte:** Säkerställer att universella engineering-principer alltid finns i kontext, oavsett vilken roll eller uppgift som är aktiv. Fungerar som teamets gemensamma grund som alla roller bygger på.

**Källa:** [engineering-principles.md](engineering-principles.md)

### Rollregler (regel per roll)

**Syfte:** Gör en specifik roll tillgänglig med sitt ansvar, sina befogenheter och begränsningar när den behövs. Aktiveras när en uppgift kräver den rollens kompetens.

**Källa:** Respektive dokument i [docs/ai/roles/](roles/)

### Plan-läge

**Syfte:** Används för att resonera, avgränsa och få användarens godkännande innan ändringar görs. Motsvarar hur Teknisk Projektledaren och Lösningsarkitekten arbetar – analys och beslut före implementation. Inga filer ändras i Plan-läge.

**Typiska roller:** Teknisk Projektledare, Lösningsarkitekt, UI/UX-designer (vid behov).

### Agent-läge

**Syfte:** Används för faktisk implementation – skriva kod, skapa filer, köra kommandon. Aktiveras först efter att plan/design är godkänd via beslutsgrindarna i Team Workflow.

**Typiska roller:** Backendutvecklare, Frontendutvecklare, Dokumentationsspecialist.

### Ask-läge

**Syfte:** Används för ren informationsinhämtning och granskning utan att göra ändringar. Lämpligt när en roll behöver analysera, verifiera eller besvara frågor utan att implementera.

**Typiska roller:** QA / Code Reviewer, Säkerhetsexpert, Teknisk Projektledare (vid behov av analys).

### Subagents / autonoma uppgifter (framtida möjlighet)

**Syfte:** En möjlig framtida mekanism för att låta en roll arbeta autonomt inom sitt mandat – t.ex. en utredning eller granskning som körs parallellt med annat arbete. Utvärderas mot designprinciperna i avsnitt 2 innan den tas i bruk.

### Framtida Cursor-funktioner

Nya funktioner i Cursor utvärderas mot samma designprinciper (avsnitt 2) innan de introduceras i AI-teamets arbetsflöde. Inte varje ny funktion behöver användas – endast de som förenklar eller förbättrar teamets arbetssätt utan att öka komplexiteten i onödan.

## 4. Arbetsstrategi

Hur Teknisk Projektledaren (i sin Cursor-realisering) använder övriga roller:

### När en roll räcker

En enskild roll räcker när uppgiften är entydigt inom ett kompetensområde och inte påverkar andra lager. Exempel:

- En ren textändring i UI → Frontendutvecklare + QA.
- En ren backend-fix utan användarpåverkan → Backendutvecklare + QA.
- En ren dokumentationsuppdatering → Dokumentationsspecialist.

### När flera roller behövs

Flera roller krävs när uppgiften spänner över lager – arkitektur, design, implementation, granskning eller dokumentation. Exempel:

- Ny funktion med UI och backend → Arkitekt, Designer, Backend, Frontend, QA, Säkerhet, Dokumentation.
- Ny känslig integration → Arkitekt, Säkerhet, Backend, QA, Dokumentation.

Beslutet om involvering fattas av Teknisk Projektledaren enligt principen om minsta nödvändiga involvering (se [team-workflow.md](team-workflow.md)).

### Sekventiellt arbete (standard)

Sekventiellt arbete är standard och följer ordningen i [team-workflow.md](team-workflow.md). En roll måste vara klar och godkänd (passera sin beslutsgrind) innan nästa tar vid. Detta gäller särskilt mellan:

- Planering → Arkitektur → Design → Implementation → QA → Säkerhet → Dokumentation → Avslut.

### Parallellt arbete (undantag)

Parallellt arbete är möjligt när roller inte är beroende av varandras resultat. Exempel:

- UI/UX-design och teknisk arkitektur kan pågå samtidigt om de inte påverkar varandra direkt.
- Backend- och frontend-implementation kan pågå parallellt om API-kontraktet är fastställt i förväg.

Parallellt arbete ska inte kringgå beslutsgrindarna – varje roll måste fortfarande godkännas innan nästa steg som beror på den påbörjas.

### Kontext vidare mellan roller

Överlämning mellan roller ska följa principen Kontextkomprimering enligt avsnitt 5.

## 5. Kontextstrategi

Principer för att hålla AI-kontext liten, relevant och kostnadseffektiv – i linje med Teknisk Projektledarens ansvar att optimera för AI-kostnad:

- **Läs endast det som behövs** – för den aktuella uppgiften och rollen, inte hela kodbasen eller alla dokument i `docs/ai/`.
- **Undvik att ladda hela projektet** – bred kontext "för säkerhets skull" ökar kostnad och riskerar att diluera fokus.
- **Återanvänd tidigare analyser** – om Arkitekten redan utrett återanvändning ska Backendutvecklaren inte göra om samma utredning.
- **Minimera tokenkostnad** – matcha kontextens omfattning mot uppgiftens faktiska komplexitet. En enkel fix behöver inte samma kontext som en ny arkitektur.

Hur överlämning mellan roller konkret ska gå till beskrivs i sin helhet av principen **Kontextkomprimering** nedan.

### Kontextkomprimering

Varje roll ska, innan den lämnar över arbetet till nästa roll, skapa en kort och strukturerad sammanfattning av:

- Vad som har gjorts
- Viktiga beslut som fattats
- Relevanta filer eller komponenter
- Kända risker eller begränsningar
- Öppna frågor
- Rekommenderat nästa steg

Som huvudregel ska endast denna sammanfattning lämnas vidare till nästa roll. Fullständiga resonemang, historik och tidigare konversationer ska endast användas när de tillför verkligt värde eller krävs för att lösa uppgiften.

**Rollseparation vid övertagande:**

> Varje roll ska utgå från föregående rolls Output Contract och leverabler, inte från hela chatthistoriken. Tidigare resonemang ska betraktas som bakgrund, inte som arbetsmaterial.

Nästa roll ska inte återberätta, återskapa eller skriva om föregående rolls arbete. Den tar vid från den strukturerade leveransen och fokuserar på sitt eget ansvar.

**Syfte:**

- Minimera AI-kostnad (tokens och beräkning).
- Minska mängden irrelevant kontext.
- Göra överlämningar snabbare och tydligare.
- Minska risken att viktig information försvinner i långa resonemang.
- Skapa samma typ av effektiva överlämningar som i ett erfaret utvecklingsteam.

## 6. Implementationsstrategi

Principer för hur dokumentationen i `docs/ai/` realiseras i Cursor:

| Dokumentation                                          | Cursor-realisering                 | Syfte                                          |
| ------------------------------------------------------ | ---------------------------------- | ---------------------------------------------- |
| [engineering-principles.md](engineering-principles.md) | Alltid-aktiv regel                 | Universella principer i varje session          |
| [roles/\*.md](roles/)                                  | En regel per roll                  | Rollspecifikt mandat när rollen aktiveras      |
| [team-workflow.md](team-workflow.md)                   | Vägledning för ordning och grindar | Hur roller kopplas och i vilken ordning        |
| Detta dokument                                         | Referens vid implementation        | Principer för hur regler skapas och underhålls |

**Grundregler:**

- Regler skapas **från** dokumentationen, aldrig tvärtom.
- Dokumentationen i `docs/ai/` är alltid den primära sanningskällan.
- Cursor-regler är en härledd, komprimerad representation – inte en parallell källa.
- Vid konflikt mellan en regel och dokumentationen gäller dokumentationen (se avsnitt 8).

### Output Contract

Varje AI-roll ska avsluta sitt arbete med en konsekvent och strukturerad leverans – ett **Output Contract**. Kontraktet är rollspecifikt (vilka fält som ingår beror på rollens leverabler) men följer samma övergripande princip: tydlig, förutsägbar output som både användaren och nästa roll kan ta vid från utan att tolka råa resonemang.

**Syfte:**

- Tydliga överlämningar mellan roller.
- Bättre kontextkomprimering (se avsnitt 5) – kontraktet är det som lämnas vidare, inte hela historiken.
- Konsekvent kommunikation i hela AI-teamet.

**Rollidentitet och överlämning (kommunikation):**

- Varje roll ska **identifiera sig tydligt** i första svaret efter aktivering eller när ett nytt uppdrag påbörjas, med en identitetsrad på egen rad (t.ex. `[Solution Architect]`). Identitetsraden upprepas inte i påföljande svar under samma arbetspass.
- När en roll **avslutar sitt arbete** och lämnar över enligt Team Workflow ska svaret avslutas med en tydlig överlämningsrad (t.ex. `Överlämning:\nDocumentation Specialist`).
- Detta är en del av Output Contract för att göra arbetsflödet lätt att följa för användaren. Överlämningsraden är en kommunikativ markering – den aktiverar inte automatiskt nästa roll och ändrar inte arbetsflödet.

**Rollseparation:**

- Varje roll utgår från **föregående rolls Output Contract och leverabler**, inte från hela chatthistoriken.
- Tidigare resonemang i chatten är **bakgrund**, inte arbetsmaterial.
- En roll beskriver aldrig i detalj hur en annan roll utförde sitt arbete; den refererar till leveransen och fokuserar på sitt eget ansvar.
- En roll får inte återskapa, omtolka eller skriva om en annan rolls leverans om den redan finns.
- **Efter överlämning:** när en roll har lämnat över betraktas dess uppdrag som avslutat. Om användaren fortsätter konversationen utan att aktivera den angivna nästa rollen ska den aktuella rollen inte fortsätta arbetet, utan endast informera om att uppgiften är överlämnad och att rätt roll behöver aktiveras. Rollen får inte börja utföra nästa rolls arbete.

Output Contract definieras av respektive roll i dess Cursor-regel och ska inte dupliceras i andra dokument. Framtida roller ska använda samma koncept, anpassat efter sin roll.

## 7. Framtida utveckling

Systemet ska kunna växa utan att bryta befintlig struktur:

- **Nya roller** – läggs till som nya dokument i `docs/ai/roles/`, följt av en motsvarande Cursor-regel. Befintliga roller behöver inte ändras.
- **Nya eller ändrade principer** – uppdateras först i `engineering-principles.md` eller `team-workflow.md`, sedan realiseras i Cursor.
- **Nya Cursor-funktioner** – utvärderas mot designprinciperna i avsnitt 2 innan de introduceras.
- **Förändringar ska vara additiva** där det är rimligt – bakåtkompatibla tillägg föredras framför brytande omstruktureringar.
- **Brytande ändringar** dokumenteras medvetet i [CHANGELOG.md](CHANGELOG.md) och i berörda källdokument, i linje med Engineering Principles om kontinuerlig förbättring och ändringshygien.

Projektspecifika tillägg (t.ex. regler för ett visst repo eller kodbas) hålls separata från den generella AI-team-implementationen och läggs till i ett dedikerat senare steg.

## 8. Grundprincip

> **Dokumentationen beskriver hur teamet ska fungera. Cursor-implementationen är endast ett sätt att realisera den. Om implementationen och dokumentationen skiljer sig åt är dokumentationen alltid den primära sanningskällan.**

Denna princip gäller alltid – vid tvekan, uppdatera dokumentationen först och anpassa Cursor-implementationen därefter.

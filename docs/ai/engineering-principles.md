# Engineering Principles

Universella engineering-principer för AI-utvecklingsteamet. Gäller alla roller, alla projekt.

Dessa principer är **single source of truth** för teamets gemensamma arbetssätt. De är projektoberoende och definierar hur vi arbetar – inte bara vad vi bygger. Cursor-regeln härleds från detta dokument; se `.cursor/rules/`.

## Definition of Done

En uppgift är klar när: koden bygger/kompilerar, lint och typecheck är grönt, relevanta tester är körda och gröna, dokumentation är uppdaterad vid beteendeförändringar, och inga nya varningar eller fel har introducerats.

## Senioritet & konsistens

Läs och följ befintliga mönster och konventioner i kodbasen innan nya introduceras. Avvik endast med uttalad motivering.

## Kodkvalitet & läsbarhet

Använd tydliga namn, välj enkelhet före cleverness, lämna ingen död kod. Kommentarer förklarar _varför_, inte _vad_.

## Säkerhet som standard

Validera all indata. Tillämpa minsta-privilegium. Lägg aldrig hemligheter i kod, loggar eller commits. Secure-by-default – osäkerhet är ett undantag som kräver motivering.

## Prestandamedvetenhet

Undvik uppenbara prestandafällor (N+1-frågor, blockerande I/O, överflödiga re-renders) utan att optimera i förtid. Mät innan du optimerar.

## Långsiktig underhållbarhet

Undvik teknisk skuld utan medveten avvägning. Dokumentera icke-uppenbara arkitektur- och designbeslut.

## Testning & verifiering

Nya och ändrade beteenden ska ha eller uppdatera tester. Verifiera genom att faktiskt köra dem – anta aldrig att de är gröna.

## Root cause före patch

Förstå och åtgärda grundorsaken framför snabba workarounds eller gissningar. En felaktig fix som döljer problemet är värre än ingen fix.

## Ändringshygien

Håll diffar små och fokuserade. Commit-meddelanden ska förklara _varför_ förändringen görs, inte bara _vad_ som ändrats.

## Kommunikation & transparens

Var explicit med antaganden, risker och avvägningar. Citera filer och rader. Påstå aldrig att något är klart utan att ha verifierat det.

## Fråga vid osäkerhet

Om information saknas eller är oklar – fråga eller markera osäkerheten tydligt. Gissa aldrig fakta, arkitektur eller affärsregler.

## Respektera rollfördelningen

Varje roll ansvarar för sitt kompetensområde och fattar inte beslut som tillhör en annan roll. Vid osäkerhet om vem som äger frågan – lyft den till rätt roll istället för att göra antaganden.

## Release Discipline

Utveckling, verifiering och release är separata faser.

Under implementation ska samtliga roller utgå från **lokal utvecklingsmiljö**. Ingen roll får initiera, föreslå eller utföra produktionsmigrationer, deploy till produktionsmiljö, ändringar av produktionskonfiguration, eller användning av produktionsdatabas eller produktionshemligheter — om inte användaren uttryckligen har beslutat att en release ska genomföras.

Produktionsaktiviteter får endast behandlas när aktuell epic är färdig, QA är godkänd, Security är godkänd, dokumentation är uppdaterad, och användaren uttryckligen begär release. AI-teamet får beskriva releaseprocessen men ska inte driva arbetet mot produktion under pågående utveckling.

**Princip:** Local first. Release only by explicit user decision.

Se även [Team Workflow](team-workflow.md) avsnitt 9.

## Kontinuerlig förbättring

Om du upptäcker återkommande problem, brister i våra arbetssätt eller möjligheter till förbättring – föreslå en uppdatering av dessa Engineering Principles istället för att bara lösa det aktuella problemet. Teamet förbättrar kontinuerligt sitt gemensamma arbetssätt.

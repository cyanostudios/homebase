Här kommer en komplett, sammanhållen summering som du kan ge till agenten. Den innehåller allt från tidigare summering och dessutom delen om Woo koden som ska städas bort.

Sammanfattning av problemet

Vi hämtar en platt lista av CDON kategorier där id är en punktnotation som beskriver hierarki, till exempel 1 som toppnivå, 1.244 som underkategori och 1.244.655 som underkategori till 1.244.

I UI blir hierarkin fel. Samma toppkategori visas två gånger, till exempel både 1 – 1 och 1 – Accessoarer. Barn och barnbarn splittras mellan dessa två rader, så vissa underkategorier hamnar under fel toppnod och det blir fel även längre ner, till exempel 134.11300.11301.

Symptomet där du får både 1.26 – 26 och 1.26 – Brudaccessoarer tyder på att samma id skapas som två olika noder med olika namn, där den ena får ett “svagt” namn som bara är siffersegmentet eller bara siffror.

Rotorsak som vi kom fram till

Problemet uppstår i frontend när kategoriträdet byggs, inte primärt i själva API hämtningen.

I ProductForm.tsx finns en tree builder som skapar syntetiska parent noder när en parent saknas i listan. Dessa syntetiska noder får ett annat internt id än riktiga kategorier, typ ett prefix som \__parent:. När UI sedan visar trädet döljs eller transformeras detta prefix, så att den syntetiska noden ser ut att vara samma kategori som den riktiga. Då får du två noder som ser likadana ut, men som är olika internt. Barn kan då kopplas till den ena eller den andra beroende på ordning, och flyttas aldrig ihop igen. Det ger exakt det du ser, dubbla toppnoder och splittrade underträd.

Det hänger ofta ihop med en fallback för namn där en placeholder nod får name lika med sista siffersegmentet, och när en riktig nod med namn dyker upp uppdateras inte samma nod utan det blir en separat nod. Då syns både 1.26 – 26 och 1.26 – Brudaccessoarer.

Målet för en ren lösning enligt best practice

En nod per verkligt id. Aldrig skapa en annan intern identifierare för samma kategori.

Om parent saknas i listan, skapa ändå parent noden men med exakt samma id som parent id. Den noden kan få ett temporärt namn, men när riktig data kommer ska samma nod uppdateras, inte att en ny nod skapas.

Bygg trädet deterministiskt i två tydliga steg.

Steg 1: skapa alla noder i en map byId och säkerställ att hela parent kedjan finns.

Steg 2: koppla barn till föräldrar via id och bygg root listan.

Hantera namn på ett tydligt sätt.

Om en nod har ett svagt namn som bara är sista siffersegmentet eller bara siffror och senare får ett bättre namn, då ska det bättre namnet vinna.

Sortera deterministiskt.

Sortera på id med numeric jämförelse så att 1.2 hamnar före 1.10.

Begränsa val i UI till riktiga kategorier.

Om vi skapar placeholder parents som inte fanns som egna poster i API svaret, låt användaren inte kunna välja dem som slutkategori. Val ska bara tillåtas om id fanns i den ursprungliga listan.

Filer att fokusera på och vad som ska kollas

1.  plugins/cdon-products/controller.js  
    Verifiera hur listan normaliseras. Kontrollera att id och path blir konsekventa och att name inte ersätts med sista segmentet i onödan. Kontrollera även att det inte sker en merge mellan två datasets som ger dubbletter.
2.  plugins/cdon-products/routes.js  
    Verifiera att frontend alltid anropar rätt endpoint med rätt query, så att den inte ibland hämtar från ett annat API som har annan struktur.
3.  client/src/plugins/cdon-products/api/cdonApi.ts  
    Verifiera att getCategories alltid skickar market och language som du förväntar dig och att den inte mappar om data på ett sätt som skapar dubbletter eller tappar name.
4.  client/src/plugins/products/components/ProductForm.tsx  
    Detta är huvudspåret. Identifiera nuvarande buildChannelCategoryTree och ta bort eller ersätt logik som skapar syntetiska id som \__parent:. Se även om UI komponenten som renderar trädet har specialfall för att dölja prefix i id och städa bort det när prefixet inte längre används.

Lägg till om Woo koden som ska städas bort

I samma ProductForm.tsx finns UI kod för att rendera trädrader som heter något i stil med WooCategoryTreeRow. Den används även för CDON och Fyndiq trädet.

Den komponenten har ett specialfall som tar bort prefixet \__parent: när node.id visas, ungefär: om id börjar med \__parent: så visa id utan prefixet.

När vi implementerar en ren tree builder utan \__parent: kommer detta specialfall aldrig triggas längre. Det blir död kod och ska tas bort för att hålla det rent.

Målet är att UI rendern inte längre har någon logik som känner till \__parent: överhuvudtaget, varken för displayId eller för onSelect spärrar.

Det innebär två städningar:

1.  ta bort visningslogiken som strippar \__parent: vid id visning
2.  ta bort spärrar som uttryckligen stoppar val av id som börjar med \__parent: eftersom de inte längre kan uppstå

Leverans som jag vill att agenten ger

En tydlig diff per fil som:  
ersätter buildChannelCategoryTree med en ren implementation utan syntetiska id  
tar bort all hantering av \__parent: i UI rendern, både display och val spärrar  
lägger in selekteringsregeln att bara riktiga id från listan kan väljas  
inte ändrar något annat i onödan

Extra testfall att be agenten validera

Testa att följande inte längre kan hända:  
1 – 1 och 1 – Accessoarer samtidigt  
1.26 – 26 och 1.26 – Brudaccessoarer samtidigt  
att 134.11300.11301 hamnar under fel gren eller visas dubbelt

En praktisk notis

Om agenten behöver öppna filerna via uppladdning i chatten igen kan de ibland “förfalla” och behöva laddas upp på nytt. I så fall ladda upp samma fyra filer igen.

Det där är hela summeringen inklusive Woo städningen.
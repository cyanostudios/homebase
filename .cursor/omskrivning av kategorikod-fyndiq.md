Det här felet kommer från hur du tolkar parent i buildFyndiqCategoryTree.

Vad som händer nu

Fyndiqs path ser ut som en kedja av kategori id, till exempel 1.423.18326.

I din nuvarande buildFyndiqCategoryTree gör du parentId så här:

parentId = alla segment före leaf, ihopslaget igen
exempel 1.423.18326 ger parentId 1.423

Men parent id i Fyndiqs hierarki är det närmaste segmentet före leaf, alltså 423.

Konsekvensen blir:

för nivå 2 funkar det av misstag
path 1.423 ger parentId 1, som finns som kategori, så 423 hamnar under 1

för nivå 3 och djupare blir parentId något som aldrig finns som verkligt id
path 1.423.18326 ger parentId 1.423, men det finns ingen kategori med id 1.423
därför kan inte noden kopplas rätt och hamnar fel

Att du nu ser en enda huvudkategori 1 Mode och att allt verkar hamna under den matchar exakt detta mönster. Alla nivå 2 noder hamnar under 1, och sedan kan alla djupare noder inte kopplas till sina riktiga parents, så de hamnar i bästa fall också vid roten eller sorteras på ett sätt som gör att det ser ut som att allt ligger under 1.

Du bad om en plan till agenten utan språk och marknad, så här är en ren plan fokuserad på listningen.

Plan till agenten i Cursor

1. Fastställ korrekt tolkning av Fyndiq path

Regel:

pathSegments = path split på punkt
leafId = sista segmentet
parentId = segmentet före leafId, inte hela prefixet

Exempel:

path 1
leaf 1
parent tomt

path 1.423
leaf 423
parent 1

path 1.423.18326
leaf 18326
parent 423

2. Ändra buildFyndiqCategoryTree så den använder närmaste parent

Agenten ska justera beräkningen av parentId:

nuvarande fel
parentId = pathSegments.slice(0, -1).join('.')

korrekt
parentId = pathSegments.length > 1 ? pathSegments[pathSegments.length - 2] : ''

Viktigt
byId ska fortsätta vara keyed på item.id, alltså verkliga id från API, aldrig path prefix

3. Behåll strikt validering men logga rätt saker

Just nu skippar du items om leafId inte matchar item.id. Det är bra, men agenten ska:

* logga hur många items som skippas och varför, i dev
* logga ett par exempel på path som skippas, max 5
* efter byggt träd, logga roots count och max depth, i dev

Det här är inte workaround, det är bara diagnostik så ni slipper gissa nästa gång.

4. Verifiera att listan verkligen innehåller alla parents

För att ett träd utan syntetiska nodes ska fungera måste parent id finnas som item i listan.

Agenten ska göra en kontroll i dev mode:

* plocka ut alla parentId som beräknas
* räkna hur många som saknas i byId
* om saknade parents finns, logga några exempel

Om Fyndiqs API mot förmodan inte returnerar alla parents i samma svar måste det hanteras enligt API specifikationen, men då är det backend eller endpointval, inte UI trädbyggaren. Med din beskrivning och tidigare dokumentation ska parents normalt finnas, så den här kontrollen bekräftar bara det.

5. Sortering ska ske per syskon, inte på hela path strängen

Din sortering använder pathById och sorterar syskon efter hela path.

Det kan ge konstig ordning, men det ska inte sabba hierarki. Ändå, best practice här:

* sortera syskon på name med localeCompare, eller på id numeric
* undvik att sortera på hela path eftersom det blandar in föräldrarna i jämförelsen

Agenten kan behålla pathById men byta till name först, sedan id som tie breaker.

6. Rensa bort nu överflödig logik om den blivit död

Efter fixen ska agenten:

* söka efter buildFyndiqCategoryTree och kontrollera att ingen annan builder används för fyndiq listan
* verifiera att buildChannelCategoryTree inte används för fyndiq längre
* leta efter dev warnings och städa bort sådant som inte längre kan inträffa

7. Acceptanskriterier

Efter ändringen ska följande vara sant:

* roots ska vara fler än 1 om API har fler än en toppkategori
* för ett känt exempel med path i tre nivåer ska noden hamna under sin direkta parent, inte under root
* expandera 1 Mode, du ska se nivå 2 kategorier, och när du expanderar en nivå 2 ska du se nivå 3 under rätt parent

8. Snabbt test agenten kan göra direkt i UI utan att gissa

Agenten ska:

* i dev tools, ta första item i listan med path som innehåller minst två punkter
* notera leaf, parent enligt regeln ovan
* söka i listan efter parent id och bekräfta att den finns
* expandera i UI och bekräfta att leaf ligger under den parentens nod

Om agenten gör punkt 2 korrekt så försvinner exakt det symptom du beskriver, eftersom hierarkin då byggs på verkliga parent id istället för path prefix.

Om du vill kan jag skriva en exakt checklista som agenten kan bocka av när den kör igenom ändringen, men planen ovan räcker för att få det rätt utan att införa syntetiska noder eller fallback.

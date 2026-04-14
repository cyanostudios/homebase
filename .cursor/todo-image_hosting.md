# Handover: Permanent media- och bildarkitektur för Products med Backblaze B2

## Mål

Bygg ett permanent media- och asset-system för Products så att:

1. appen kan fortsätta köras lokalt under utveckling
2. produktbilder lagras externt i Backblaze B2
3. publika bild URL:er används i kanalpayloads till CDON och Fyndiq
4. media separeras per kund via kontonummer
5. produktens sparade remote media-data är enda sanningen för alla kanalpayloads
6. UI använder rätt bildvariant
7. associerade filer i hosting tas bort när produkten tas bort från plattformen
8. lösningen byggs korrekt från start utan att grundarkitekturen behöver göras om senare

Detta ska vara den permanenta arkitekturen för produktmedia.

---

## Beslut som redan är tagna

1. Vi använder Backblaze B2 som extern lagring för produktbilder.
2. Appen ska kunna fortsätta köras lokalt medan bilderna ligger publikt i B2.
3. Kanalpayloads till CDON och Fyndiq får aldrig använda lokala filvägar.
4. Kanalpayloads får aldrig använda Sellos original URL direkt som permanent källa.
5. Produktens sparade remote media-data ska vara enda sanningen för kanalpayloads.
6. Media ska separeras per kund via kontonummer, inte via tenant-begrepp i paths eller modellnamn.
7. Dedupe får aldrig baseras på filnamn.
8. Dedupe ska baseras på innehåll, alltså hash av filens bytes.
9. Asset-systemet ska från start stödja flera varianter per bild.
10. Varje bild ska ha minst tre varianter:
11. original
12. preview
13. thumbnail
14. I UI ska preview användas i produktens detaljvy eller produktfönster.
15. Thumbnail ska byggas in i asset-systemet redan nu även om den inte används överallt i UI ännu.
16. Originalfilnamn ska sparas separat och vara det som visas i UI, inte hash-baserat storage-filnamn.
17. Om en produkt tas bort från plattformen ska associerade bilder tas bort från B2.
18. Vi ska inte bygga signed URLs.
19. Vi ska inte bygga komplex CDN proxy.
20. Vi ska inte bygga avancerad TinyPNG eller TinyJPG-liknande komprimering i denna leverans.
21. Arkitekturen ska dock förberedas så att sådan bildoptimering kan läggas till senare utan att datamodellen görs om.
22. Om samma filnamn används igen men filinnehållet är annorlunda ska bilden behandlas som en ny bild.
23. Om exakt samma bildinnehåll används igen för samma produkt ska systemet kunna återanvända asseten.
24. För kanalpayloads ska original-varianten användas, inte preview eller thumbnail.
25. För nuvarande UI räcker det att detaljvyn använder preview. Thumbnail byggs ändå in i systemet nu för korrekt arkitektur.
26. Visat filnamn i UI ska vara originalfilnamn eller ursprungligt namn från källan, inte storage key.
27. Om bilder tas bort från en produkt medan produkten finns kvar ska de borttagna asset-filerna också tas bort från B2 när de inte längre används av produkten.

---

## Önskat slutläge

När detta är klart ska följande gälla:

1. En produkt kan ha en eller flera bilder.
2. Varje bild lagras i Backblaze B2.
3. Varje bild får tre varianter:
4. original
5. preview
6. thumbnail
7. Produktens data sparar full metadata om dessa bilder.
8. Produktens `main_image` pekar på korrekt publik URL för huvudbildens originalvariant om det fältet används av befintlig kanal- eller produktlogik.
9. Produktens `images` innehåller full metadata och URL:er för varje asset och dess varianter.
10. UI använder preview-bilden i detaljvyn.
11. CDON-payload använder sparad remote media-data.
12. Fyndiq-payload använder sparad remote media-data.
13. Lager- eller saldouppdateringar utan bildändring triggar inte ny upload.
14. Om exakt samma bild återkommer ska systemet kunna återanvända den för samma produkt utifrån innehållshash, inte utifrån filnamn.
15. Om en annan bild laddas upp med samma filnamn ska den ändå identifieras som ny fil och laddas upp som ny asset.
16. Om en produkt tas bort ska alla dess associerade assets i B2 tas bort.
17. Om en bild tas bort från en befintlig produkt ska de associerade asset-filerna tas bort från B2.
18. Ingen del av kanalpayload eller mediahantering får bygga på lokala paths som permanent källa.
19. Ingen del av systemet får exponera B2 credentials till klienten.

---

## Scope för denna leverans

### Bygg detta nu

1. extern lagring av produktbilder i Backblaze B2
2. permanent asset-system med metadata
3. separering av filer per kontonummer
4. generering och lagring av original, preview och thumbnail
5. lagring av `originalFilename` separat från `storageKey`
6. användning av publika URL:er i CDON- och Fyndiq-payloads
7. uppdatering av UI så att produktens media i detaljvyn använder preview-versionen
8. radering av associerade assets när produkt tas bort
9. radering av associerade assets när bilder tas bort från en befintlig produkt
10. innehållsbaserad dedupe
11. tydlig loggning och felhantering
12. tydlig storage-abstraktion så att B2 kan bytas senare om det behövs
13. stöd för framtida optimering utan att ändra datamodellen

### Bygg inte detta nu

1. avancerad TinyPNG eller TinyJPG-liknande komprimering eller kvalitetsstyrning i UI
2. progressbar i UI för framtida komprimeringssteg
3. komplex CDN proxy
4. signed URLs
5. avancerad köhantering för bakgrundsprocessning

### Viktigt

Det som skjuts upp är extrafunktioner, inte grundarkitekturen.

---

## Lagringstjänst

Använd Backblaze B2 som origin storage för alla produktbilder.

Appen körs fortsatt lokalt under utveckling, men bilder ska laddas upp till B2 så att vi får publikt nåbara och stabila https URL:er som kan skickas till CDON och Fyndiq.

Alla bild URL:er som används i kanalpayloads ska komma från B2.

---

## Miljövariabler

Lägg till följande env variabler:

```env
STORAGE_DRIVER=b2

B2_ENDPOINT=https://s3.eu-central-003.backblazeb2.com
B2_REGION=eu-central-003
B2_BUCKET=your-bucket-name
B2_KEY_ID=...
B2_APPLICATION_KEY=...
B2_PUBLIC_BASE_URL=https://f004.backblazeb2.com/file/your-bucket-name
MEDIA_PREVIEW_MAX_WIDTH=1400
MEDIA_PREVIEW_MAX_HEIGHT=1400
MEDIA_THUMBNAIL_MAX_WIDTH=320
MEDIA_THUMBNAIL_MAX_HEIGHT=320
MEDIA_ALLOWED_MIME=image/jpeg,image/png,image/webp,image/gif
MEDIA_MAX_FILE_BYTES=20971520
MEDIA_FETCH_TIMEOUT_MS=15000
```

**Regler**

1. B2_PUBLIC_BASE_URL ska användas för att bygga publika URL:er.
2. Inga credentials får exponeras i frontend.
3. Upload till B2 ska ske från backend eller lokal backendprocess.
4. Ingen kanalbyggare får prata direkt med B2.
5. Alla nya bild- och mediafunktioner ska vara backend-drivna.
6. Inga B2-nycklar får läcka till logs.

---

**Separering per kund via kontonummer**

All media ska separeras med hjälp av kontonummer.

Detta ska användas i:

1. storage keys
2. metadata per asset
3. borttagning av filer
4. felsökning
5. framtida stöd för flera kunder i samma plattform

Använd inte tenant som begrepp i paths eller filstruktur.  
Använd istället accountNumber.

---

**Storage key-struktur**

Alla filer i B2 ska lagras under paths som innehåller:

1. accountNumber
2. productId
3. variant
4. assetId eller position
5. hash av innehållet
6. korrekt filändelse

**Använd denna struktur**

accounts/{accountNumber}/products/{productId}/original/{assetId}\_{hash}.{ext}

accounts/{accountNumber}/products/{productId}/preview/{assetId}\_{hash}.{ext}

accounts/{accountNumber}/products/{productId}/thumbnail/{assetId}\_{hash}.{ext}

**Exempel**

accounts/100245/products/123/original/0_49555115d9b064e33853f3748fa7e80efe8dfee1.jpg

accounts/100245/products/123/preview/0_49555115d9b064e33853f3748fa7e80efe8dfee1.webp

accounts/100245/products/123/thumbnail/0_49555115d9b064e33853f3748fa7e80efe8dfee1.webp

**Krav**

1. URL:erna ska vara svårgissade i praktiken genom att hash används.
2. Filnamn i storage får inte vara användarens originalfilnamn.
3. Originalfilnamn ska sparas som metadata och visas i UI separat.
4. Samma filnamn får aldrig användas som identitet för dedupe eller lagring.
5. assetId ska vara stabilt inom produktens bildlista. Det kan vara ett internt ID eller en stabil position vid skapande.
6. hash ska vara hash på bildens bytes efter att originalfilen lästs in. Rekommenderat är SHA-256 i hex.
7. Samma hash får inte ensam vara global identitet mellan olika produkter. Storage key ska alltid inkludera både accountNumber och productId.

---

**Asset-system**

Varje produktbild ska representeras som ett media asset-objekt med metadata och flera varianter.

**Varje asset ska innehålla minst**

1. assetId
2. accountNumber
3. productId
4. position
5. originalFilename
6. sourceUrl om sådan finns
7. hash
8. mimeType
9. size
10. width
11. height
12. metadata för original
13. metadata för preview
14. metadata för thumbnail

**Rekommenderad intern struktur i images**

[

  {

    "assetId": "0",

    "accountNumber": "100245",

    "productId": 123,

    "position": 0,

    "originalFilename": "produktbild fram.jpg",

    "sourceUrl": "[https://images.sello.io/products/acc/46496/49555115d9b064e33853f3748fa7e80efe8dfee1.jpg](https://images.sello.io/products/acc/46496/49555115d9b064e33853f3748fa7e80efe8dfee1.jpg)",

    "hash": "49555115d9b064e33853f3748fa7e80efe8dfee1",

    "mimeType": "image/jpeg",

    "size": 456789,

    "width": 2000,

    "height": 2000,

    "variants": {

      "original": {

        "key": "accounts/100245/products/123/original/0_49555115d9b064e33853f3748fa7e80efe8dfee1.jpg",

        "url": "[https://f004.backblazeb2.com/file/your-bucket-name/accounts/100245/products/123/original/0_49555115d9b064e33853f3748fa7e80efe8dfee1.jpg](https://f004.backblazeb2.com/file/your-bucket-name/accounts/100245/products/123/original/0_49555115d9b064e33853f3748fa7e80efe8dfee1.jpg)",

        "mimeType": "image/jpeg",

        "size": 456789,

        "width": 2000,

        "height": 2000

      },

      "preview": {

        "key": "accounts/100245/products/123/preview/0_49555115d9b064e33853f3748fa7e80efe8dfee1.webp",

        "url": "[https://f004.backblazeb2.com/file/your-bucket-name/accounts/100245/products/123/preview/0_49555115d9b064e33853f3748fa7e80efe8dfee1.webp](https://f004.backblazeb2.com/file/your-bucket-name/accounts/100245/products/123/preview/0_49555115d9b064e33853f3748fa7e80efe8dfee1.webp)",

        "mimeType": "image/webp",

        "size": 123456,

        "width": 1400,

        "height": 1400

      },

      "thumbnail": {

        "key": "accounts/100245/products/123/thumbnail/0_49555115d9b064e33853f3748fa7e80efe8dfee1.webp",

        "url": "[https://f004.backblazeb2.com/file/your-bucket-name/accounts/100245/products/123/thumbnail/0_49555115d9b064e33853f3748fa7e80efe8dfee1.webp](https://f004.backblazeb2.com/file/your-bucket-name/accounts/100245/products/123/thumbnail/0_49555115d9b064e33853f3748fa7e80efe8dfee1.webp)",

        "mimeType": "image/webp",

        "size": 18345,

        "width": 320,

        "height": 320

      }

    }

  }

]

**Kommentar om main_image**

Om befintlig kod, UI eller payloadbyggare använder main_image, behåll det fältet.  
Sätt då main_image till original URL för huvudbilden.

Detta gör att gammal kod inte bryts i onödan.

**Kommentar om images**

images ska innehålla den fulla strukturen ovan eller så nära den som möjligt.  
Om vissa äldre koddelar förväntar sig en enklare form måste adapterlogik byggas i service-lagret så att intern struktur ändå är korrekt.

---

**Datamodell och schema**

**Krav i Products**

Tenant-logik för produkter finns redan på plats i appen, men för media ska vi använda kontonummer i modell och paths.

Säkerställ att products stöder följande:

1. main_image som text om det inte redan finns
2. images som JSONB om det inte redan finns i rätt form
3. updated_at ska uppdateras när media ändras

**Om schema redan finns**

Om main_image och images redan finns ska befintliga fält återanvändas.  
Ändra inte UI- eller API-kontrakt mer än nödvändigt.

**Om schema behöver kompletteras**

Skapa migration som säkerställer:

1. main_image finns
2. images finns som JSONB
3. eventuellt default är [] för images

**Inga dataflyttar krävs**

Om ingen produktdata finns ännu behövs ingen komplex migrering av befintliga bilder.  
Fokus är att få rätt schema och rätt logik på plats.

---

**Arkitektur och filplacering**

**Skapa eller komplettera följande moduler**

server/

  services/

    storage/

      storage.types.ts

      index.ts

      [b2.storage](http://b2.storage).ts

      media-asset.service.ts

      image-processing.service.ts

  plugins/

    products/

      services/

        products.service.ts

        product-media.service.ts

      controllers/

      routes/

  channels/

    cdon/

      payload-builder.ts

    fyndiq/

      payload-builder.ts

**Ansvar per modul**

**storage.types.ts**

Definierar kontrakt för object storage provider.

**[b2.storage](http://b2.storage).ts**

Implementerar uppladdning, borttagning, existenskontroll och URL-generering för Backblaze B2.

**image-processing.service.ts**

Ansvarar för:

1. validering av bild
2. läsning av metadata
3. generering av preview
4. generering av thumbnail
5. beräkning av hash

**media-asset.service.ts**

Ansvarar för:

1. skapa asset metadata
2. skapa storage keys
3. ladda upp varianter till B2
4. returnera komplett asset-struktur
5. hantera delete av asset-filer

**product-media.service.ts**

Ansvarar för:

1. koppling mellan produkt och media-assets
2. synk av produktens bildkällor
3. dedupe-logik
4. uppdatering av main_image
5. uppdatering av images
6. radering av borttagna assets vid produktuppdatering
7. radering av alla assets vid produktdelete

**payload-builder.ts för CDON och Fyndiq**

Ansvarar endast för att läsa färdig produktdata och använda rätt publika URL:er.

Inga uppladdningar får ske här.

---

**Storage provider**

**Definiera ett tydligt interface**

Skapa ett interface i stil med:

export interface ObjectStorageProvider {

  uploadBuffer(input: {

    key: string

    buffer: Buffer

    contentType: string

    cacheControl?: string

  }): Promise<{

    key: string

    publicUrl: string

    etag?: string

  }>

 

  exists(key: string): Promise<boolean>

 

  deleteObject(key: string): Promise<void>

 

  deleteObjects(keys: string[]): Promise<void>

 

  getPublicUrl(key: string): string

}

**Implementera Backblaze B2 via S3-kompatibel klient**

Använd till exempel @aws-sdk/client-s3 och konfigurera den mot Backblaze B2 endpoint.

Krav:

1. rätt endpoint
2. rätt region
3. bucket från env
4. inga credentials i frontend
5. support för upload
6. support för delete
7. support för exists
8. support för public URL generation

---

**Bildbehandling**

**Använd ett bibliotek för bildprocessning**

Använd ett bibliotek som kan:

1. läsa metadata
2. skala om bilder
3. skapa preview
4. skapa thumbnail
5. eventuellt konvertera preview och thumbnail till webp

Exempel är sharp.

**Regler för varianter**

**Original**

1. ska i normalfallet lagras i originalformat om det är giltigt och stöds
2. ska bevara hög kvalitet
3. ska vara den variant som används i kanalpayloads
4. ska ha korrekt filändelse och MIME type

**Preview**

1. ska användas i produktens detaljvy i UI
2. ska skalas ned till rimlig maxstorlek
3. ska vara betydligt lättare än original
4. får gärna sparas som webp för mindre filstorlek om det stöds i appen

Rekommenderade maxmått:

1. max width: 1400
2. max height: 1400

**Thumbnail**

1. ska byggas redan nu i asset-systemet
2. ska vara liten och lätt
3. behövs för korrekt framtidssäker arkitektur även om den inte används brett i UI i dag

Rekommenderade maxmått:

1. max width: 320
2. max height: 320

**Viktigt**

Vi bygger inte avancerad TinyPNG-liknande optimering nu.  
Men användningen av sharp eller motsvarande för resize och variantgenerering är en del av grundarkitekturen och ska byggas nu.

---

**Validering av bilder**

**Tillåtna MIME-typer**

Minst följande ska tillåtas:

1. image/jpeg
2. image/png
3. image/webp
4. image/gif om det behövs av befintliga produktflöden

**Regler**

1. kontrollera response content type vid extern hämtning
2. verifiera att filen faktiskt går att läsa som bild
3. avvisa filer som inte är giltiga bilder
4. tillämpa max filstorlek
5. tillämpa timeout vid hämtning från extern URL
6. logga tydligt vad som gick fel

**Rekommenderade gränser**

1. max filstorlek: 20 MB
2. fetch timeout: 15 sekunder

---

**Dedupe och återanvändning**

**Grundregel**

Dedupe får aldrig baseras på filnamn.  
Dedupe ska baseras på innehåll.

**Praktisk logik**

1. läs in filens bytes
2. beräkna hash på innehållet
3. använd hash som del av assetens identitet och storage key
4. om produkten redan har en asset med samma hash på samma bildposition och samma accountNumber och productId kan den återanvändas
5. om filnamnet är samma men hash skiljer sig ska ny upload ske
6. om sourceUrl är densamma men hash skiljer sig ska ny upload ske
7. om sourceUrl är samma och hash är samma ska ingen ny upload ske

**Viktig konsekvens**

Om någon laddar upp image1.jpg idag och en helt annan image1.jpg i morgon ska den senare behandlas som en ny bild.

---

**Bildkällor som måste stödjas**

**Flöde 1: extern källa, till exempel Sello-bild**

Stöd detta flöde:

1. läs source URL från produkten eller importkällan
2. hämta bildfilen
3. validera att den är en bild
4. läs buffer
5. beräkna hash
6. bygg original, preview och thumbnail
7. ladda upp alla tre till B2
8. spara full metadata i produkten

**Flöde 2: lokal fil**

Stöd detta flöde:

1. läs fil från disk eller uploadflöde
2. läs buffer
3. beräkna hash
4. skapa varianter
5. ladda upp till B2
6. spara metadata

**Flöde 3: produkt uppdateras utan bildändring**

Stöd detta flöde:

1. om befintlig asset metadata finns
2. om inga bildkällor har ändrats
3. återanvänd befintlig remote media-data
4. gör ingen ny upload

---

**Produktmedia-service**

**Skapa en dedikerad service**

Skapa en service, till exempel product-media.service.ts, som ansvarar för all koppling mellan produkt och media.

**Ansvar**

1. läsa produktens nuvarande media
2. jämföra inkommande bildkällor med befintliga assets
3. avgöra vilka assets som ska återanvändas
4. avgöra vilka nya assets som ska skapas
5. avgöra vilka assets som ska tas bort
6. uppdatera produktens main_image
7. uppdatera produktens images
8. radera B2-filer när en bild försvinner från produkten
9. radera B2-filer när produkten tas bort

**Exempel på public API för servicen**

type EnsureProductMediaInput = {

  accountNumber: string

  productId: string | number

  imageSources: Array<{

    sourceUrl?: string

    localPath?: string

    originalFilename?: string

    position: number

  }>

}

 

type EnsureProductMediaResult = {

  mainImage: string | null

  images: Array<any>

}

 

type DeleteProductMediaInput = {

  accountNumber: string

  productId: string | number

  images: Array<any>

}

---

**Generering av varianter**

**För varje ny eller ändrad bild ska följande ske**

1. läs originalbuffer
2. beräkna hash
3. extrahera metadata
4. skapa originalasset
5. skapa previewasset
6. skapa thumbnailasset
7. ladda upp samtliga till B2
8. bygg komplett metadataobjekt
9. returnera objektet till product-media-service

**Variantregler**

**Original**

1. används i kanalpayloads
2. hög kvalitet
3. ska bevara tillräcklig upplösning för marknadsplatser

**Preview**

1. används i produktens detaljvy
2. lättare än original
3. snabbare att ladda i UI

**Thumbnail**

1. byggs nu
2. används senare i listor, mediaöversikter och andra vyer
3. ska finnas i metadata redan nu

---

**Cache och headers**

Vid upload till B2 ska rimlig cache control sättas.

Rekommendation:

Cache-Control: public, max-age=31536000, immutable

Detta är lämpligt eftersom filnamnet innehåller hash.  
När bilden ändras får den ny hash och därmed ny URL.

---

**UI-ändringar**

**Nuvarande läge**

Bilder syns i dag i detaljvyn eller produktfönstret.

**Krav för denna leverans**

1. detaljvyn ska sluta förlita sig på lokala paths
2. detaljvyn ska läsa preview URL från produktens sparade media-data
3. visat filnamn ska vara originalFilename
4. om preview saknas av någon anledning kan UI falla tillbaka till original URL, men preview ska vara normalläget
5. thumbnail behöver inte användas i fler vyer nu, men dess metadata och lagring ska finnas på plats

**Viktigt**

UI ska uppdateras så att det använder rätt versioner av bilder.  
Det räcker för denna leverans att detaljvyn använder preview.  
Kanalpayloads ska fortsatt använda original.

---

**Kanalintegration**

**CDON**

CDON payload builder ska:

1. läsa produktens sparade media-data
2. använda huvudbildens original URL
3. vid behov använda fler bilders original URL:er i rätt ordning
4. aldrig försöka ladda upp bilder
5. aldrig använda lokal filväg
6. aldrig använda Sellos original URL direkt

**Fyndiq**

Fyndiq payload builder ska:

1. läsa produktens sparade media-data
2. använda huvudbildens original URL
3. vid behov använda fler bilders original URL:er i rätt ordning
4. aldrig försöka ladda upp bilder
5. aldrig använda lokal filväg
6. aldrig använda Sellos original URL direkt

**Regel**

Payload builders får bara läsa färdig produktdata.  
All upload och mediahantering ska redan vara klar innan payload byggs.

---

**Delete-logik**

**När en produkt tas bort**

När en produkt tas bort från plattformen ska alla associerade filer i B2 tas bort.

Detta inkluderar för varje asset:

1. original
2. preview
3. thumbnail

**När en bild tas bort från en befintlig produkt**

Om användaren tar bort en bild från en produkt ska assetens filer i B2 också tas bort, förutsatt att de inte längre refereras av produkten.

**Praktisk implementation**

1. läs produktens befintliga images
2. extrahera alla keys för alla varianter
3. skicka delete mot B2 för samtliga keys
4. uppdatera eller ta bort produkten i databasen

**Felhantering vid delete**

1. delete av produkt i databas och delete av filer i B2 måste hanteras noggrant
2. om databasdelete sker först och B2 delete fallerar ska felet loggas tydligt
3. om B2 delete sker först och databasdelete fallerar måste detta loggas tydligt
4. använd en robust strategi där produktens media keys finns tillgängliga innan delete påbörjas
5. delete-logik ska vara idempotent så långt det går

**Rekommenderad ordning**

För produktdelete:

1. läs produkt och samla alla keys
2. försök ta bort alla B2-objekt
3. om B2-delete lyckas, fortsätt med produktdelete
4. om B2-delete delvis misslyckas, logga exakt vilka keys som misslyckades
5. avgör om produktdelete ska blockeras eller tillåtas enligt befintlig app-policy

För denna leverans rekommenderas strikt policy:

1. om B2-delete misslyckas ska delete-operationen returnera fel och inte tyst ignorera problemet
2. detta minskar risken för att orphaned files lämnas kvar utan kontroll

**Rekommenderad komplettering**

Skapa en intern hjälpfunktion som samlar alla keys från images för en produkt, till exempel:

function collectAllMediaKeys(images: any[]): string[] {

  // original, preview, thumbnail från varje asset

}

---

**Logging**

**Logga detta**

1. media upload start
2. media upload success
3. media upload skipped på grund av återanvändning
4. media validation failed
5. media fetch failed
6. preview generation success eller failure
7. thumbnail generation success eller failure
8. product media update success
9. product media delete success eller failure
10. payload builder val av image URL

**Logga inte detta**

1. B2 credentials
2. application keys
3. hela binärdata
4. känsliga tokens

---

**Error handling**

**Definiera tydliga felkoder eller feltyper**

Minst följande ska finnas:

1. PRODUCT_MEDIA_FETCH_FAILED
2. PRODUCT_MEDIA_INVALID_IMAGE
3. PRODUCT_MEDIA_UPLOAD_FAILED
4. PRODUCT_MEDIA_PROCESSING_FAILED
5. PRODUCT_MEDIA_DELETE_FAILED
6. PRODUCT_MEDIA_MISSING_FOR_CHANNEL
7. PRODUCT_MEDIA_SCHEMA_INVALID

**Regler**

1. om en kanal kräver bild och ingen giltig original URL finns ska produkten inte få publiceras
2. om preview eller thumbnail misslyckas men original lyckas ska hela operationen ändå betraktas som fel i denna leverans, eftersom asset-systemet ska vara komplett från start
3. om delete av media misslyckas ska detta inte tyst ignoreras

---

**Testplan**

**Enhetstester**

Bygg minst tester för:

1. storage key-generering
2. hash-generering
3. dedupe-logik
4. public URL-generering
5. variantgenerering
6. insamling av delete keys
7. validering av MIME type
8. fallback-logik mellan preview och original i UI-adapter om sådan finns

**Integrationstester**

Bygg minst tester för:

1. produkt med extern URL laddas upp till B2
2. produkt med lokal fil laddas upp till B2
3. produkt får original, preview och thumbnail
4. produktens main_image sätts korrekt
5. produktens images sparas med full metadata
6. CDON payload använder original URL från sparad media-data
7. Fyndiq payload använder original URL från sparad media-data
8. lageruppdatering utan bildändring gör ingen ny upload
9. samma filnamn men annat innehåll ger ny upload
10. samma innehåll ger återanvändning
11. borttagning av bild från produkt raderar asset-filer från B2
12. borttagning av produkt raderar alla asset-filer från B2

**Manuell testchecklista**

1. skapa produkt med en eller flera bilder
2. verifiera att original, preview och thumbnail finns i B2
3. verifiera att produktens images innehåller korrekt metadata
4. öppna preview URL i browser
5. öppna original URL i browser
6. verifiera att detaljvyn använder preview
7. verifiera att UI visar originalfilnamn
8. bygg CDON payload och verifiera att original URL används
9. bygg Fyndiq payload och verifiera att original URL används
10. uppdatera bara saldo eller lager och verifiera att ingen ny upload sker
11. ladda upp ny bild med samma filnamn men annat innehåll och verifiera att ny asset skapas
12. ta bort en bild från produkten och verifiera att dess filer tas bort från B2
13. ta bort produkten och verifiera att alla associerade filer tas bort från B2

---

**Implementation i rekommenderad ordning**

1. lägg till env variabler
2. skapa storage provider interface
3. implementera Backblaze B2 provider
4. skapa image processing service för metadata, hash, preview och thumbnail
5. skapa media asset service för upload och asset metadata
6. skapa product media service för synk mellan produkt och media
7. uppdatera products schema om det behövs
8. uppdatera produkter så att main_image och images används konsekvent
9. uppdatera delete-flöde för produkt så att media raderas från B2
10. uppdatera flöde för borttagning av enskild bild från produkt
11. uppdatera CDON payload builder
12. uppdatera Fyndiq payload builder
13. uppdatera UI i detaljvy så att preview används
14. lägg till tester
15. kör manuell end to end-verifiering

---

**Konkreta tekniska krav till agenten**

**1. Bygg inte bara en enkel upload**

Detta ska inte bli ett enkelt flöde där en fil laddas upp och en URL sparas.  
Det ska bli ett riktigt asset-system med metadata och tre varianter per bild.

**2. Basera aldrig återanvändning på filnamn**

Samma filnamn får förekomma flera gånger för olika bilder.  
Hash av bytes ska styra om filen är samma eller inte.

**3. Separera alltid med kontonummer**

Alla storage keys och all asset metadata ska vara knutna till accountNumber.

**4. Spara både intern och användarvänlig identitet**

Spara både:

1. storageKey
2. publicUrl
3. originalFilename

Det användaren ser i UI ska vara originalFilename.  
Det systemet använder internt ska vara storageKey och publicUrl.

**5. Kanaler ska läsa, inte skapa**

CDON- och Fyndiq-byggarna får bara läsa färdig media-data från produkten.  
De får inte trigga upload eller bearbetning.

**6. Produktdelete måste radera filer**

När en produkt tas bort ska dess media raderas från B2.  
Detta är inte valfritt.

**7. Bildborttagning från produkt måste radera filer**

När en bild tas bort från en produkt ska dess media raderas från B2.  
Detta är inte valfritt.

**8. UI ska uppdateras nu**

Detaljvyn ska sluta bygga på lokala filer och istället använda sparad preview URL.

**9. Arkitekturen ska vara redo för senare optimering**

Avancerad TinyPNG-liknande komprimering byggs inte nu.  
Men eftersom asset-systemet redan har flera varianter och metadata ska sådan funktion kunna läggas till senare utan schemaomtag.

---

**Leveranskrav**

Agenten ska leverera:

1. kod för B2 storage provider
2. kod för image processing service
3. kod för media asset service
4. kod för product media service
5. koppling till Products
6. koppling till CDON payload builder
7. koppling till Fyndiq payload builder
8. produktdelete som raderar associerad media i B2
9. bilddelete från produkt som raderar associerad media i B2
10. uppdaterad UI-detaljvy som använder preview
11. eventuella migrations som behövs för main_image och images
12. lista på ändrade filer
13. instruktion för vilka env variabler som måste sättas
14. kort beskrivning av var i produkt- och publish-flödet media säkerställs

---

**Acceptanskriterier**

Detta är klart först när alla punkter nedan fungerar:

1. appen körs lokalt
2. produktbilder kan laddas upp till Backblaze B2
3. original, preview och thumbnail skapas för varje bild
4. produktens main_image och images sparas korrekt
5. UI:s detaljvy använder preview-varianten
6. UI visar originalfilnamn, inte hash-namn
7. CDON payload använder sparad original URL från produktens media-data
8. Fyndiq payload använder sparad original URL från produktens media-data
9. uppdatering av lager eller saldo utan bildändring gör ingen ny upload
10. samma filnamn men nytt innehåll ger ny asset
11. samma bildinnehåll kan återanvändas korrekt inom produktens mediaflöde
12. när en bild tas bort från produkt tas dess filer bort från B2
13. när en produkt tas bort tas alla dess associerade filer bort från B2
14. inga B2 credentials exponeras till klienten
15. ingen kanalpayload använder lokal filväg eller Sellos original URL som permanent källa

---

**Slutregel**

Det ska finnas exakt en källa för kanalernas bild URL:er:

produktens sparade remote media-data i Products.

Inte lokal disk.  
Inte Sellos original URL.  
Inte on the fly upload i kanalbyggaren.

Bygg detta rent, modulärt och permanent så att storage kan bytas senare utan att Products, CDON eller Fyndiq behöver skrivas om.

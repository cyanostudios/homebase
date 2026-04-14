Du har rätt.

Det där skulle ha varit mycket kortare och utan allt extra. Ingen backfill, ingen migrering, inga gamla produkter, inget omskrivande av befintliga assets.

Kopiera detta till agenten:

````md
# Ändring av B2-path och publik bilddomän

Målet är bara detta:

1. Publika bild-URL:er ska byggas med `https://media.syncer.se`
2. Nya B2-keys ska inte innehålla `tenants/`
3. Nya B2-keys ska inte innehålla `sello-`
4. Ingen backfill eller migrering ska göras
5. Vi utgår från att Homebase är tom på produkter och att inga gamla produkter eller gamla assets behöver uppdateras

## Ny önskad struktur

Använd denna key-struktur för nya uploads från och med nu:

```txt
{tenantId}/products/{productId}/{variant}/{position}_{assetId}_{hash}.{ext}
```
````

Exempel:

```txt
1/products/58324746/original/0_e5a443b5-db44-4349-b68e-34a7787f6597_330d732626764a4f93b3df4acbe55fbe1f72fc288a328730eb6edd565c4a2744.jpg
1/products/58324746/preview/0_e5a443b5-db44-4349-b68e-34a7787f6597_330d732626764a4f93b3df4acbe55fbe1f72fc288a328730eb6edd565c4a2744.webp
1/products/58324746/thumbnail/0_e5a443b5-db44-4349-b68e-34a7787f6597_330d732626764a4f93b3df4acbe55fbe1f72fc288a328730eb6edd565c4a2744.webp
```

## Viktiga regler

1. Inget `tenants/` prefix
2. Ingen mapp som heter `sello-58324746`
3. Produktmappen ska bara vara själva produkt-id:t, alltså `58324746`
4. Första segmentet ska vara tenant-id direkt, alltså till exempel `1`
5. `products` får ligga kvar
6. Varianten ska fortsatt vara `original`, `preview`, `thumbnail`

## Publik URL

Använd:

```env
MEDIA_PUBLIC_BASE_URL=https://media.syncer.se
```

Så att publika URL:er för nya assets blir i stil med:

```txt
https://media.syncer.se/1/products/58324746/original/...
```

Inte Backblaze Friendly URL som publik URL utåt.

## Vad som ska ändras i koden

Ändra bara det som behövs för nya uploads och nya publika URL:er.

### 1. `b2ObjectStorage.js`

Ändra key-bygget så att nya keys följer:

```txt
{tenantId}/products/{productId}/{variant}/{position}_{assetId}_{hash}.{ext}
```

Ändra public URL-bygget så att det använder `MEDIA_PUBLIC_BASE_URL` som primär publik domän.

### 2. Ta bort gamla prefixes i path

Om kod idag bygger något som:

- `tenants/{tenantId}/...`
- `sello-{id}`
  så ska det bort för nya uploads.

Om produkt-id kommer in som `sello-58324746` ska pathen använda `58324746`.

Det här gäller bara storage path, inte någon stor ombyggnad av resten av appen.

### 3. Behåll resten

Rör inte mer än nödvändigt.
Behåll:

- B2 som lagring
- Cloudflare som publik domän
- preview och thumbnail-logik
- delete-logik
- payload builders

Payload builders ska fortsatt bara läsa produktens sparade bild-URL:er. När nya assets sparas med `media.syncer.se` ska det automatiskt bli rätt utåt.

## Gör inte detta

1. Ingen backfill
2. Ingen migrering av gamla filer
3. Ingen uppdatering av gamla produkter
4. Ingen speciallogik för befintliga assets
5. Ingen ombyggnad av hela media-systemet

## Leverans

Jag vill bara ha:

1. ändrade filer
2. kort beskrivning av exakt vad som ändrats
3. bekräftelse på att nya uploads nu får paths som:
   `1/products/58324746/original/...`
4. bekräftelse på att nya publika URL:er nu blir:
   `https://media.syncer.se/1/products/58324746/original/...`

```

```

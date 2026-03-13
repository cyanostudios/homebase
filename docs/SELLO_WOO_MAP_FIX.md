# Varför channel_product_map inte fylls för WooCommerce vid Sello-import

## Diagnostik (kör: `node scripts/debug-sello-woo-map.js 51786284`)

### Resultat

- **Sello returnerar `item_id: null`** för WooCommerce-integrationerna (55051 = Mobilhallen, 59961 = merchbutiken-se).
- CDON och Fyndiq får sträng-UUID i `item_id` → `externalId` blir ifylld → `upsertChannelProductMap` anropas.
- För WooCommerce är `item_id` alltid `null` i API-svaret → `externalId = ""` → vi skriver **aldrig** till `channel_product_map` för WooCommerce.

Därför har produkt 51786284 (och andra) overrides för WooCommerce men ingen map-rad, och lager-push till WooCommerce körs inte.

### Orsak

Sello API ger inte WooCommerce product ID i `integrations[integrationId].item_id` för WooCommerce-integrationer (antingen bugg, begränsning eller att produkten inte synkats från Sello till Woo). Dokumentationen säger att `item_id` är "marketplace product identifier" – för WooCommerce verkar det i praktiken vara null.

---

## Lösning (implementera när du säger "kör")

**Idé:** När Sello inte ger `item_id` för en WooCommerce-integration men produkten är aktiv på den integrationen (vi skapar ändå override), gör en **WooCommerce API-lookup** med SKU och skriv `external_id` till `channel_product_map` om vi hittar produkten.

- Vid export till Woo sätter vi SKU = `product.id` (standalone) eller `V{product.id}` (variant).
- `findWooProductBySku(base, sku, settings)` i `plugins/woocommerce-products/controller.js` returnerar Woo-produkten med `.id` (Woo product/variation id).
- Products-controllern har redan `this.wooController` och kan anropa `findWooProductBySku`.

**Steg i koden (Sello-import, båda vägarna – selloProductIds och sidindelad):**

1. I loopen där vi gör `upsertChannelOverride` och sedan `if (externalId) { upsertChannelProductMap(...) }` för varje `inst`:
   - Om `inst.channel === 'woocommerce'` **och** `externalId` är tom (Sello gav inte `item_id`):
     - Hämta WooCommerce-instansen: t.ex. `await this.wooController._getInstanceOrThrow({ ...req, query: { instanceId: String(inst.id) } })`.
     - Bygg `wooSettings` från instansens credentials (storeUrl, consumerKey, consumerSecret [och useQueryAuth om behövs]).
     - `base = this.wooController.normalizeBaseUrl(wooInst.credentials.storeUrl)` (eller motsvarande – kontrollera att metoden finns/is public).
     - Först sök variant: `existing = await this.wooController.findWooProductBySku(base, 'V' + productId, wooSettings)`.
     - Om inte hittat: `existing = await this.wooController.findWooProductBySku(base, String(productId), wooSettings)`.
     - Om `existing?.id`: anropa `upsertChannelProductMap` med `externalId: String(existing.id)` (samma övriga fält som idag).
2. Hantera fel tyst (t.ex. catch och logga, eller bara låta misslyckad lookup betyda att vi inte skriver map) så att importen inte kraschar om Woo är nere eller produkten inte finns i Woo.

**Filer att ändra**

- `plugins/products/controller.js`: i båda blocken där integrations loopas (selloProductIds-vägen och sidindelad import), för WooCommerce när `!externalId`, lägg in Woo-lookup och vid träff anropa `upsertChannelProductMap` med `externalId = existing.id`.

**Viktigt**

- Ingen fallback till andra fält eller andra kanaler – bara: Sello `item_id` finns → använd den; för Woo saknas den → en Woo-lookup med SKU (productId / V+productId), och bara om vi hittar produkten skriver vi map.
- Regeln "no fallbacks" uppfylls: vi gissar inte, vi använder antingen Sello `item_id` eller Woo API-svar.

---

## Verifiering

Efter fix:

1. Importera produkt 51786284 från Sello igen (eller kör import för den).
2. Kör `node scripts/check-channel-map.js 51786284` → ska visa rader för WooCommerce (inst 8, ev. 11) i `channel_product_map` med `external_id` satt.
3. Ändra lager i UI och bekräfta att lager pushas till WooCommerce.

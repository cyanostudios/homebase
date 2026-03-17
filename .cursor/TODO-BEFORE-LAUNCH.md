# To-Do Before Launch

Items to address before production launch. Not blocking but recommended.

---

## Product sync optimizations

### 1. Quantity-only from Edit → use light sync

**Current:** Saving from the product Edit form always triggers full export to Fyndiq/CDON/Woo, even when only quantity changed.

**Desired:** When the only change is quantity (and optionally status), call `pushStockToChannels` instead of full export. This would:
- Use Fyndiq's `PUT /articles/:id/quantity`, CDON's stock endpoint, WooCommerce stock sync
- Avoid full payloads and image URL validation
- Work in dev when images are localhost URLs

**Implementation:**
- Add a "changed fields" check before sync in `ProductContext.saveProduct`
- Define a set of fields that trigger full export: title, description, mainImage, images, priceAmount, markets, texts, channelCategories, etc.
- If none of those changed and quantity (or status) changed → call pushStockToChannels
- Otherwise → full export as today

**Files:** `client/src/plugins/products/context/ProductContext.tsx`, possibly backend `plugins/products/controller.js`

---

### 2. Partial Fyndiq/CDON updates (future)

**Context:** Fyndiq has `PUT /articles/:id/price` for price-only updates. When enabling a new market (e.g. DK) and setting price, we could theoretically use lighter endpoints instead of full article payload.

**Note:** Requires checking Fyndiq/CDON API docs for what partial updates support (add market vs only update existing price). Lower priority than quantity-only above.

---

## Other

- **Sello import – bildlagring:** Vid Sello-import sparas idag **Sello-bild-URL:er** (images.sello.io) direkt i `main_image`/`images`, så att export till CDON/Fyndiq/Woo fungerar utan att appen behöver vara publikt tillgänglig. **När vi är färdiga med Sello-fasen:** byt till riktig lagring (nedladdning till server eller moln, t.ex. R2/S3 eller `server/uploads`) och använd dessa URL:er i export-payloaden. Se `plugins/products/controller.js` – `getSelloImageUrls` (nu) vs `downloadSelloImages` (behålls för framtida användning).

- Images: In dev, mainImage/images often use localhost URLs, causing full export to fail. Quantity-only sync (above) would avoid that for quantity edits. (Sello-import använder nu Sello-URL:er, så nyimporterade produkter har publika bild-URL:er.)

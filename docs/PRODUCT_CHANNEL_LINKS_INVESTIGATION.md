# Undersökning: Kanallänkar i produktlistan (hover-popup)

## Korrekt beteende (produkter importerade från Sello)

Produkter importeras från Sello. Sello ger en unik länk vid export till kanalerna.

För produkt 105780548:
- **CDON:** `https://cdon.{tld}/produkt/7291deade72d56ba/` (samma slug för SE, DK, FI)
- **Fyndiq:** `https://fyndiq.{tld}/produkt/b13867b91ef5470e/` (samma slug för SE, DK, FI)
- **WooCommerce:** `https://api.sello.io/v5/products/105780548/link/46496/55051` (Sello redirect)

### Två typer av rader i `channel_product_map`

| Källa | channel_instance_id | external_id | market |
|-------|---------------------|-------------|--------|
| **CDON/Fyndiq-sync** | NULL | `105780548` (SKU) | null |
| **Sello build** | satt | UUID t.ex. `7291dead-e72d-56ba-9a2c-39aaf5c770b8` | se, dk, fi |

**Sello-raderna är korrekta.** URL-format: UUID utan bindestreck, första 16 tecken (t.ex. `7291deade72d56ba`).

### Nuvarande fix

1. **Föredra Sello-rader** över sync-rader per (channel, market)
2. **URL-format:** UUID → ta bort bindestreck, använd första 16 tecken
3. **WooCommerce:** Kräver backend-stöd (storeUrl/Sello-länk returneras inte idag)

## Köra debug själv

```bash
node scripts/debug-product-channel-links.js [productId]
# eller
PRODUCT_ID=123 node scripts/debug-product-channel-links.js
```

Om productId saknas används första produkten som har minst en mapping.

## Källor till channel_product_map

| Källa | channel_instance_id | external_id |
|-------|---------------------|-------------|
| CDON export/sync | NULL | SKU eller productId |
| Fyndiq export/sync | NULL | SKU eller productId |
| Sello build (Bygg kanalkarta) | instance-id | Sello `item_id` (ofta UUID) |
| WooCommerce | instance-id | Woo product ID |

WooCommerce-länkar byggs inte i frontend (backend returnerar inte storeUrl).

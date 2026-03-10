# Manuell testchecklista: Sello ID som products.id

Denna checklista täcker import, export, order-sync och UI för ändringarna i "Sello ID as products.id".

## Förberedelser

- [ ] Ta bort befintliga produkter via batch-delete i UI (eller API) innan import
- [ ] Säkerställ att Sello-integrationen är konfigurerad (API-nyckel, etc.)

## 1. Sello-import

- [ ] Kör Sello-import (en eller flera produkter)
- [ ] Verifiera att `products.id` = Sello product id (t.ex. 49558203)
- [ ] Verifiera att `products.sku` = `merchant_sku` (Sello `private_reference`) eller null – inte Sello id
- [ ] För varianter: verifiera att `parent_product_id` = Sello id för huvudprodukten

## 2. Produktlista (UI)

- [ ] Öppna produktlistan
- [ ] Verifiera att produkter visas med rätt id (Sello id)
- [ ] Verifiera att SKU-kolumnen visar merchant_sku (eller tom om null)

## 3. CDON-export

- [ ] Exportera produkter till CDON
- [ ] Verifiera att artiklar skickas med `sku` = `product.id` (Sello id)
- [ ] För varianter: verifiera att `parent_sku` sätts till parent’s id
- [ ] Kontrollera i CDON:s gränssnitt att artiklarna har rätt SKU

## 4. Fyndiq-export

- [ ] Exportera produkter till Fyndiq
- [ ] Verifiera att artiklar skickas med `sku` = `product.id` (Sello id)
- [ ] För varianter: verifiera att `parent_sku` sätts till parent’s id
- [ ] Kontrollera i Fyndiq:s gränssnitt att artiklarna har rätt SKU

## 5. WooCommerce-export

- [ ] Exportera produkter till WooCommerce
- [ ] Verifiera att WooCommerce SKU-fält = `product.id` (Sello id)
- [ ] Verifiera att befintliga produkter matchas via SKU = product.id

## 6. Order-sync (CDON)

- [ ] Synka ordrar från CDON
- [ ] Verifiera att orderrader med `article_sku` matchas mot `products.id` (WHERE id::text = article_sku)
- [ ] Kontrollera att orderrader kopplas till rätt produkt

## 7. Order-sync (Fyndiq)

- [ ] Synka ordrar från Fyndiq
- [ ] Verifiera att orderrader med `article_sku` matchas mot `products.id`
- [ ] Kontrollera att orderrader kopplas till rätt produkt

## 8. Automatiska tester

Kör enhetstester:

```bash
npm test -- --testPathPattern="sello-id|phase2Contract"
```

Dessa tester verifierar:

- CDON/Fyndiq-mappare: `sku` = `product.id`, ingen fallback till `product.sku`
- `parent_sku` sätts från `product.parentProductId`
- `getCdonArticleInputIssues` / `getFyndiqArticleInputIssues`: `missing_sku` när `product.id` saknas

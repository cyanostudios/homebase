# Produkter: bulk delete och partial failure

`DELETE /api/products/batch`

Body:

```json
{
  "ids": ["123", "124", "125"]
}
```

Svar vid full framgang:

```json
{
  "ok": true,
  "partial": false,
  "requested": 3,
  "deleted": 3,
  "deletedIds": ["123", "124", "125"],
  "failedCount": 0,
  "failed": []
}
```

Svar vid delvis framgang:

```json
{
  "ok": false,
  "partial": true,
  "requested": 3,
  "deleted": 2,
  "deletedIds": ["123", "124"],
  "failedCount": 1,
  "failed": [
    {
      "productId": "125",
      "code": "PRODUCT_MEDIA_DELETE_FAILED",
      "message": "Failed to delete product media from B2",
      "details": {
        "productId": "125",
        "reason": "delete_product"
      }
    }
  ]
}
```

Policy:

- En enskild produkt far **inte** tas bort ur databasen om dess associerade B2-media inte kunde raderas.
- Bulk delete ar **partial**: andra produkter i samma request far fortfarande tas bort om deras media-delete lyckas.
- `failed[].code` ar avsedd att kunna visas i UI eller loggas vidare for felsokning.

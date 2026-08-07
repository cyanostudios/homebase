# Public Clubdesk PHP APIs

Same-origin JSON for the Clubdesk public site. Requires `APP_DB_URL` (tenant Postgres with `clubdesk_*` tables).

| File              | Method | Response                                      |
| ----------------- | ------ | --------------------------------------------- |
| `items.php`       | GET    | `{ items, categoryOrder }` — published guides |
| `price_lists.php` | GET    | `{ priceLists }` — published price lists      |
| `sitemap.php`     | GET    | XML sitemap (guides + price lists)            |
| `health.php`      | GET    | Health check                                  |

Published only. See [`../README.md`](../README.md).

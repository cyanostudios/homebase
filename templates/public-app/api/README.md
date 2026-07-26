# Public app API (PHP)

Read-only endpoints for the public site. Env: `APP_DB_URL` (tenant Postgres).

| File                   | Role                                        |
| ---------------------- | ------------------------------------------- |
| `health.php`           | Liveness — Docker / Railway HEALTHCHECK     |
| `items.php`            | Whitelisted list JSON `{ "items": [...] }`  |
| `item_detail.php`      | Single item `?slug=`                        |
| `sitemap.php`          | Dynamic XML (rewritten from `/sitemap.xml`) |
| `pdo_env.php`          | PDO from env                                |
| `db_helpers.php`       | SQL helpers (placeholder table `items`)     |
| `cors.php`             | `APP_ALLOWED_ORIGINS`                       |
| `security_headers.php` | Shared headers                              |

See [`../README.md`](../README.md) and [`docs/PUBLIC_APP_TEMPLATE.md`](../../docs/PUBLIC_APP_TEMPLATE.md).

# Public app API (PHP)

Read-only endpoints for the public site. Env: `APP_DB_URL` (tenant Postgres).

| File                   | Role                                                   |
| ---------------------- | ------------------------------------------------------ |
| `health.php`           | Liveness — Docker / Railway HEALTHCHECK                |
| `items.php`            | Whitelisted list JSON `{ "items": [...] }` (published) |
| `item_detail.php`      | Single instruction `?slug=` (published + steps)        |
| `sitemap.php`          | Dynamic XML (rewritten from `/sitemap.xml`)            |
| `pdo_env.php`          | PDO from env (`APP_DB_URL`)                            |
| `db_helpers.php`       | SQL helpers for `instructions` / `instruction_steps`   |
| `cors.php`             | `APP_ALLOWED_ORIGINS`                                  |
| `security_headers.php` | Shared headers                                         |

See [`../README.md`](../README.md) and [`docs/PUBLIC_APP_TEMPLATE.md`](../../docs/PUBLIC_APP_TEMPLATE.md).

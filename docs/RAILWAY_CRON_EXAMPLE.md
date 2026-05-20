# Railway Cron: cups auto-refresh (Homebase)

Konfigurera på **Homebase**-tjänsten (inte Cupappen).

## Variabel

| Name          | Value                     |
| ------------- | ------------------------- |
| `CRON_SECRET` | `openssl rand -base64 32` |

Samma värde som i Homebase Railway Variables.

## Cron job (Railway dashboard)

| Field       | Value                                                  |
| ----------- | ------------------------------------------------------ |
| Schedule    | `0 3 * * *` (dagligen 03:00 UTC — justera efter behov) |
| HTTP method | `POST`                                                 |
| URL         | `https://<your-homebase-domain>/api/cron/cups/refresh` |
| Header      | `x-cron-secret: <CRON_SECRET>`                         |

## Manuell test

```bash
curl -fsS -X POST \
  -H "x-cron-secret: $CRON_SECRET" \
  "https://<your-homebase-domain>/api/cron/cups/refresh"
```

Se [CUPS_AUTO_REFRESH_CRON.md](./CUPS_AUTO_REFRESH_CRON.md) för beteende och per-tenant opt-in.

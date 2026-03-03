# Get started with Neon

Quick start for using **Neon** (serverless Postgres) with Homebase and with Cursor.

**Main Homebase Neon project (Cursor/agent):** **Homebase 2512** — use this project when working against the database from Cursor/Neon MCP.

---

## 1. Neon in Cursor (ready)

The **Neon Postgres** plugin in Cursor is set up and authenticated. You can:

- Use **`/`** to run Neon-related commands or invoke the neon-postgres skill.
- Ask the agent to manage Neon projects, branches, or run SQL (the agent uses the Neon MCP server when relevant).

No extra setup needed in Cursor for the plugin.

---

## 2. Use Neon as Homebase’s database

Homebase supports Neon in two ways:

- **Single database:** point `DATABASE_URL` to a Neon connection string (main app + all tenants in one DB or with schemas).
- **Database per tenant:** set `TENANT_PROVIDER=neon` and `NEON_API_KEY` so each user gets their own Neon project/database.

### Minimal setup (single Neon database)

1. **Sign up / log in:** [console.neon.tech](https://console.neon.tech)
2. **Create a project** (e.g. `homebase-main`) and copy the **connection string** from Connection details.
3. **In your app env** (e.g. `.env.local`):

   ```bash
   DATABASE_URL=postgresql://user:password@ep-xxx.neon.tech/neondb?sslmode=require
   ```

4. Run migrations and start the app. No `NEON_API_KEY` needed for this.

### Database-per-tenant (Neon project per user)

1. Do the steps above so `DATABASE_URL` points to your **main** Neon (or other Postgres) database where the `tenants` table lives.
2. In Neon Console: **Account Settings → Developer settings → API Keys** → create an API key. Copy it once.
3. In `.env.local`:

   ```bash
   TENANT_PROVIDER=neon
   NEON_API_KEY=your_neon_api_key
   # Optional: NEON_REGION=aws-eu-central-1
   ```

4. Restart the server. New signups will get a dedicated Neon project/database; connection strings are stored in `tenants`.

Full details, troubleshooting, and security notes: **[Neon integration setup](NEON_SETUP.md)**.

---

## 3. Quick reference

| Goal                        | What to do                                                                         |
| --------------------------- | ---------------------------------------------------------------------------------- |
| Use Neon from Cursor        | Plugin is authenticated; use `/` or ask the agent about Neon.                      |
| Run Homebase on one Neon DB | Set `DATABASE_URL` to Neon connection string.                                      |
| One Neon DB per user        | Set `TENANT_PROVIDER=neon` and `NEON_API_KEY`; see [NEON_SETUP.md](NEON_SETUP.md). |
| Check tenant DBs            | `node scripts/check-neon-tenant.js` (requires `DATABASE_URL`).                     |

---

- [Neon Console](https://console.neon.tech)
- [Neon API reference](https://neon.tech/docs/api-reference)
- [Homebase Neon setup (detailed)](NEON_SETUP.md)

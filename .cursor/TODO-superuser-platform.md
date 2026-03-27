# To-Do: Superuser & plattforms-dashboard

---

## Vision (produkt)

- **Superuser** = plattformsägare (du): kan se och hantera kunder/tenants, inte bara eget konto.
- **Inloggning som superuser:** liten **dashboard** där man kan:
  - **Godkänna** nya registreringar (kö / pending) innan konto + tenant blir fullt aktivt.
  - **Tilldela pluginpaket** per tenant (t.ex. bara Besiktning, bara E‑handel/Selloklon, kombinationer) – styr `tenant_plugin_access` (och ev. prisnivå senare).
- **Superuser ska ha tillgång till alla plugins** (även nya som läggs till i repot) utan att behöva “fylla på” manuellt – medveten regel, inte samma bugg som `ensureTenantPluginAccess` på login för alla tenants.
- **Dev-flöde:** Logga in som superuser → **byt tenant** till det konto du experimenterar med → fortsätt jobba i Selloklon (import m.m.) tills du är redo. **Separat:** logga in med vanliga kontot och jobba “som kund” utan admin-läge.
- **Kunder:** T.ex. någon som bara ska ha Besiktningar – ska kunna få rätt paket utan att systemet automatiskt öppnar alla moduler (styrning via godkännande + paket, inte bara signup).

---

## Vad som redan finns i koden (baseline)

- **`users.role`:** `user` vs `superuser` (superuser sätts manuellt / via `POST /api/admin/update-role`, inte via signup).
- **`server/core/routes/admin.js`:** bl.a. `GET /api/admin/tenants`, `POST /api/admin/switch-tenant` (byter sessionens tenant till en annan owners tenant), `POST /api/admin/update-role`.
- **`client/src/core/ui/TopBar.tsx`:** om `user.role === 'superuser'`, hämtar tenant-lista och kan anropa switch-tenant.
- **Tenant-modell:** `public.tenants`, `tenant_memberships`, `tenant_plugin_access`; Neon: nytt **projekt** per tenant via API vid signup (`NeonTenantProvider`), connection string sparas i `tenants` – ingen manuell `DATABASE_URL` per kund i `.env`.

---

## Luckor att fylla (när arbetet drar igång)

1. **Godkännande + paket i UI** – finns inte: signup skapar konto + tenant direkt. Behöver t.ex. pending-state, admin-actions, och tydlig skrivning till `tenant_plugin_access` per paket.
2. **Superuser & plugins i session** – vid `switch-tenant` uppdateras inte nödvändigtvis `session.user.plugins` till måltenantens lista; “exakt kundens vy” kan kräva `/me`-omladdning eller backend som sätter plugins efter byte. Separat: **superuser ska alltid se alla plugins** som egen regel.
3. **`ensureTenantPluginAccess` vid login** – idag kan det fylla på alla moduler för alla tenants; för paket/pris måste det ersättas eller styras (miljöflagga, bara dev, eller helt bort för prod-tenants).
4. **Fler användare i samma tenant** (t.ex. Kalle admin + anställd) – membership stödjer flera users per `tenant_id`, men det finns inget färdigt “bjud in”-flöde i UI; kan kopplas till samma epok som dashboarden.

---

## Referenser i repo

- Auth & plugin-hantering: `server/core/routes/auth.js` (`ensureTenantPluginAccess`, signup).
- Admin routes: `server/core/routes/admin.js`.
- Tenant-skapande: `server/core/services/tenant/providers/NeonTenantProvider.js`, `LocalTenantProvider.js`.

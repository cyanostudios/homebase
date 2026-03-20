# Homebase Documentation

Det här är den **aktuella** ingången till dokumentationen. Målet är att hålla få dokument som är uppdaterade, och flytta historik/“vad som ändrats” till `CHANGELOG.md`.

## Snabbstart (ny utvecklare)

- **Arkitektur & core services:** `CORE_SERVICES_ARCHITECTURE.md`
- **Plugin-arkitektur (V3 Action Registry):** `PLUGIN_ARCHITECTURE_V3.md`
- **UI/UX-regler:** `UI_AND_UX_STANDARDS_V3.md`
- **Säkerhet:** `SECURITY_GUIDELINES.md`
- **Dev/Deploy:** `DEVELOPMENT_GUIDE_V2.md`, `DEPLOYMENT_V2.md`

## Canonical dokument (hålls uppdaterade)

- **Changelog / historik:** `CHANGELOG.md`
- **Core services (Adapter pattern):** `CORE_SERVICES_ARCHITECTURE.md`
- **Core-arkitektur (översikt + TopBar widgets):** `CORE_ARCHITECTURE_V2.md` _(översikt – uppdateras vid stora layout/flow-ändringar)_
- **Plugin-arkitektur (V3):** `PLUGIN_ARCHITECTURE_V3.md`
- **Plugin-standarder (mandatory):** `PLUGIN_DEVELOPMENT_STANDARDS_V2.md`
- **Refaktorera befintliga plugins:** `REFACTORING_EXISTING_PLUGINS.md`
- **Mentions & cross-plugin UI:** `MENTIONS_AND_CROSS_PLUGIN_UI.md`
- **Tenant/users/RBAC:** `TENANT_USERS_AND_RBAC.md`
- **UI/UX:** `UI_AND_UX_STANDARDS_V3.md`
- **Security:** `SECURITY_GUIDELINES.md`
- **Deploy:** `DEPLOYMENT_V2.md`
- **Lessons learned / vanliga misstag:** `LESSONS_LEARNED.md`

## Dokumentationspolicy

- **Sanningen om “vad som ändrats”** ska hamna i `CHANGELOG.md` (kronologiskt, kortfattat, med länkar till relevanta filer).
- **Referenser till filer/paths** i docs ska uppdateras när filer flyttas/byter namn.
- **UI-handlingar i paneler** ska beskrivas som delade panel-actions (header/footer) när logiken är gemensam; undvik footer-only formuleringar om implementationen använder båda.
- **Redundanta “V2”-översikter** som duplicerar ovanstående ska tas bort efter att ev. unika delar har flyttats in i canonical docs eller `CHANGELOG.md`.

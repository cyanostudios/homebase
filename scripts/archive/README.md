# Archived one-off migration scripts

These scripts were run manually during development and have **no** `npm run migrate:*` entry in `package.json`.
Keep for audit/re-run on old environments only — production schema is defined in `server/migrations/`.

| Script                                      | Purpose                                            |
| ------------------------------------------- | -------------------------------------------------- |
| `run-contacts-migration.js`                 | `007-add-is-assignable-to-contacts`                |
| `run-slots-migration.js`                    | Initial kiosk/slots schema (`029-kiosk`)           |
| `run-slots-contact-migration.js`            | Kiosk contact column                               |
| `run-matches-contact-migration.js`          | Matches contact link                               |
| `run-matches-format-nullable-migration.js`  | Matches format nullable                            |
| `run-matches-map-link-migration.js`         | Matches map link                                   |
| `run-matches-name-migration.js`             | Matches name field                                 |
| `run-matches-number-migration.js`           | Matches number field                               |
| `run-matches-referee-migration.js`          | Matches referee                                    |
| `run-matches-type-migration.js`             | Matches type                                       |
| `run-grant-cups-plugin-access-migration.js` | Grant cups plugin access (`059`)                   |
| `run-cups-dedupe-by-source.js`              | Data repair: dedupe cups by source (CLI `--apply`) |

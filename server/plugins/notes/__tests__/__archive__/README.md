# Archived notes tests

`notes.test.js` targeted a pre–V2 API (`createNote`, `getNote`, …) that no longer exists on `plugins/notes/model.js` (now `create(req, …)`, `getById(req, …)` with tenant pool via `Database.get(req)`).

Kept for reference; not run by Jest (`testPathIgnorePatterns` includes `__archive__`).

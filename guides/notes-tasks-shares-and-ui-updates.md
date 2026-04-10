# Notes, tasks, slots — shares, dialogs, and detail UI

This guide summarizes behaviour and operations added or changed alongside **task public shares** (parity with notes) and related **frontend UX** adjustments.

See also: [`lazy-plugin-providers-architecture.md`](lazy-plugin-providers-architecture.md), [`docs/PLUGIN_RUNTIME_CONVENTIONS.md`](../docs/PLUGIN_RUNTIME_CONVENTIONS.md).

---

## Task public shares

- **Table:** `task_shares` (migration `server/migrations/068-task-shares.sql`).
- **Run on each environment:** `npm run migrate:task-shares` (applies SQL to tenant DBs; same pattern as note shares).
- **Fresh installs:** `scripts/setup-database.js` creates `task_shares` and indexes when used.
- **API (plugins/tasks):** create/list/revoke shares; `GET /api/tasks/public/:token` for read-only public task (same session/tenant-pool constraints as note public routes).
- **Client:** `taskShareApi`, `TaskShareBlock`, share actions under **Export options** in the task detail sidebar; blue link panel **under assignee** in the main column; route **`/public/task/:token`** → `PublicTaskView`.

---

## Note shares (layout)

- **Share / View** actions stay under **Export options** (sidebar).
- **Active link** panel (`NoteShareBlock`) is in the **main column**, **below file attachments** (when the files plugin is enabled).

---

## Note → task conversion

- One **To task** quick action opens the cross-plugin dialog.
- **DuplicateDialog** supports an optional **second action** (`secondActionText` / `onSecondAction`): **Create and delete note** — same behaviour as the former separate quick action.
- **`openToTaskDialog`** in `AppContext` is **`(note) => void`** only (no `deleteNoteAfter` option on open; choice is in the dialog).
- **`buildNoteToTaskOnConfirm`** no longer takes `setDeleteNoteAfterTask`.

---

## Slots detail view

- **Past slot** message (`slots.slotDatePassed`) is **not** in the panel header subtitle; it appears in **`SlotMainInfoCard`** under the slot name, **above** start/end dates, in **red** with **`AlertCircle`**, using **`h-[1lh]`** on the icon column for line-height-aligned layout.
- **`slots.nameLabel`** is **Name** / **Namn** (removed “(På slot)”).

---

## Shared detail typography

- **`DetailSection`** accepts **`prominentTitle`**: uses **`Heading` `size="2xl"`** so note and task **main title** rows match the slot detail headline size.

---

## i18n keys (reference)

- **`app.createTaskAndDeleteNote`** — third button in create-task-from-note dialog.
- **`tasks.*`** — share strings for task share block and actions (see `en.json` / `sv.json` under `tasks` and `app`).

---

## Operational checklist

| Action                            | Command or note                                                   |
| --------------------------------- | ----------------------------------------------------------------- |
| Add `task_shares` to existing DBs | `npm run migrate:task-shares`                                     |
| Verify tasks plugin routes        | `plugins/tasks/routes.js` — public + shares before generic `/:id` |

# Garments (Kläder) — operator notes

Plugin id: **`garments`**. Sport nav label: **Kläder**.

## Enable (local)

```bash
npm run migrate:garments
# or grant only after schema exists:
npm run set:tenant-plugins -- --enable=garments
```

Then **log out and log in** so `/api/auth/me` refreshes `user.plugins`.

Production / `--both` only when you explicitly request release (Release Discipline).

## Surfaces

| View          | Purpose                                                                                   |
| ------------- | ----------------------------------------------------------------------------------------- |
| **Lists**     | Clothing checklists: persons, sizes, jersey #, admin checkbox columns; optional team link |
| **Inventory** | Simple stock rows (article, brand, size, qty, comment) — not linked to lists in v1        |
| **Settings**  | List layout (cards/table, column count)                                                   |

## Person rows (list detail)

Each person is a **two-row block** (not a spreadsheet table):

1. **Identity** — full name (wraps), optional `#jersey` badge, Edit/Delete. Comment under the name when present (admin only).
2. **Kit + status** — shirt / shorts / socks sizes; checkbox columns wrap with a visible label each. Checkboxes stay clickable while editing the row.

Duplicate jersey numbers on the same list show a non-blocking warning (save is allowed).

## Sharing

Notes-style view-only link. Creates `garment_list_shares` + main-DB `public_share_routing` (`resource_type = garment_list`). Public page: `/public/garment-list/:token`.

Public person blocks use the same two-row layout, **read-only** (no Edit/Delete; checkboxes disabled). **Comments are hidden** (API clears `comment`; UI does not show the field).

## Teams

When both `teams` and `garments` are enabled, Team detail has a **Kläder** tab listing lists for that team.

## Security residuals

Unauthenticated share links can expose youth names, sizes, jersey numbers, and checkbox status. Same residual class as Notes public shares. See [`docs/ai/security/GARMENTS_PUBLIC_SHARE_ETAPP1.md`](ai/security/GARMENTS_PUBLIC_SHARE_ETAPP1.md). Prefer short expiry and revoke after use. **Local first; no prod** without an explicit release.

## ADR

[`docs/ai/adr/GARMENTS_PLUGIN_ETAPP1.md`](ai/adr/GARMENTS_PLUGIN_ETAPP1.md)

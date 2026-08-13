# Cupappen fallback cover images

Used when a cup has no `featured_image_url` (listing cards + SSR detail/OG).

## Preferred: admin upload

In Homebase → Cups → **Settings → Appearance → Fallback photos**, upload as many images as you want (max 100). URLs are stored in tenant table `cups_site_config` and served via `GET /api/fallback_images.php`.

Requires: `npm run migrate:cups-site-config` (local + prod tenant when releasing).

## Built-in defaults (this folder)

If the admin pool is empty, Cupappen uses the JPEGs here (`01.jpg` …). Replace these for offline/default branding; keep names in sync with `DEFAULT_FALLBACK_IMAGES` in `app.js` and the default list in `cup.php`.

## Assignment

Listing and detail pick an image with the same CRC-32 of `cup.id` (or name) as PHP `cup.php` — same cup → same fallback on cards, header, and related.

## Security

- Public `GET /api/fallback_images.php` exposes the URL list without auth (**R-FB-1**, by design — same class as public cover URLs). Awaiting TPM conscious acceptance (see `docs/CHANGELOG.md`).
- Prefer HTTPS CDN/R2 URLs in production (**R-FB-2**); set `PUBLIC_CUPS_USER_ID` on Cupappen (**R-FB-3**).

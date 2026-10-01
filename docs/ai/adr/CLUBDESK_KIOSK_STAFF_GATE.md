# ADR: Clubdesk kiosk staff gate

**Status:** Accepted (implemented) — **temporarily paused for local stock UX (2026-09-30)**  
**Date:** 2026-09-30  
**Scope:** Public Clubdesk inventory article and `POST /api/inventory_quantity.php`. Garments unchanged.  
**Supersedes:** The sentence in [`CLUBDESK_KIOSK_MASTER_CATALOG.md`](CLUBDESK_KIOSK_MASTER_CATALOG.md) §7 that the kiosk article shows `comment` because the page is the admin surface. Anonymous HTML does not show `comment`. A valid staff cookie does.

## Temporary pause (local development)

Stock +/- on the article and `POST /api/inventory_quantity.php` are open again (same-origin only). The “Personal” unlock UI is removed from the article. The internal note (`comment`) stays off the public page. Cookie helpers and `POST /api/kiosk_session.php` remain in the tree for re-enable before release. Do not ship this pause to production without Security re-review.

## Context

The public inventory article can change variant quantity and was rendering the internal note (`comment`). The host is the public Clubdesk site. Same-origin checks stop another website from posting, but any client that can reach the host can set `Origin` itself. There is no existing kiosk session or shared admin cookie: admin and the public site are different hosts.

The catalog (published articles, quantities, facts) stays public. The stock write and the internal note do not.

## Decision

1. **One server secret.** `PUBLIC_CLUBDESK_KIOSK_SECRET` is read only on the server. It is not committed, not rendered, and not placed in JavaScript. If it is missing or shorter than 32 characters, the gate is closed.

2. **Stateless cookie.** No new table and no PHP session store. `POST /api/kiosk_session.php` accepts JSON `{ "secret": string }`, keeps the existing same-origin check, and compares the value with `hash_equals`. On match it sets cookie `clubdesk_kiosk`. The value is `{expiryUnix}.{hmac}` where `hmac` is `hash_hmac('sha256', expiryUnix, secret)`. Expiry is at most 12 hours ahead. The cookie is `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` when the request is HTTPS.

3. **Fail closed.** A wrong secret returns 401 and sets no cookie. A closed gate returns 503 on unlock. `POST /api/inventory_quantity.php` keeps same-origin and, before any read-for-update or insert, requires a valid cookie. Otherwise 401 and no write.

4. **Article HTML.** `inventory.php` renders stock buttons and `comment` only when the cookie is valid. Anonymous HTML still shows the published article, variants, and quantities. List and detail JSON still omit `comment`.

5. **Opening the gate from the page.** The client POSTs the secret with `credentials: 'same-origin'`, then reloads. The secret is not stored in the page. How that control looks is not decided here.

## Rejected

- **Admin session cookie.** The public host does not receive the admin host's session.
- **Secret embedded in the page or in JavaScript.** Anyone who can open the article could then write stock.
- **Leaving the write and the note anonymous.** Already rejected on the security gate.

## Verified implementation (2026-09-30)

| Item              | Location                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| Cookie helpers    | `public-clubdesk/api/kiosk_gate.php`                                                                               |
| Unlock            | `POST /api/kiosk_session.php`                                                                                      |
| Stock write gate  | `public-clubdesk/api/inventory_quantity.php` (cookie before transaction)                                           |
| Article HTML gate | `public-clubdesk/inventory.php` (`$staffGateOpen`)                                                                 |
| Tests             | `public-clubdesk/__tests__/kioskGate.test.js`                                                                      |
| Unlock control    | `inventory.php` details “Personal” + `kiosk-unlock-app.js` when the secret is configured and the cookie is missing |

## Security residuals (Gate 5 Approved 2026-09-30)

| ID       | Severity | Risk                                                                       | Notes                                                                                                      |
| -------- | -------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **KG-1** | Low      | Anyone who knows `PUBLIC_CLUBDESK_KIOSK_SECRET` can open a 12-hour cookie. | By design. Unique secret per environment; rotate if leaked. **TPM conscious acceptance at release.**       |
| **KG-2** | Low      | Unlock has no rate limit.                                                  | Keep the secret ≥32 random characters. Optional rate limit later. **TPM conscious acceptance at release.** |

Article unlock: when `PUBLIC_CLUBDESK_KIOSK_SECRET` is configured (≥32 chars) and the cookie is missing, the article shows a “Personal” details control. The secret is typed by staff, POSTed to `/api/kiosk_session.php`, then the page reloads. The secret is not embedded in HTML or JS.

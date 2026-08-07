<?php
declare(strict_types=1);

require_once __DIR__ . '/api/pdo_env.php';
require_once __DIR__ . '/api/db_helpers.php';
require_once __DIR__ . '/api/security_headers.php';
applyPublicAppSecurityHeaders('html');

function h(?string $value): string
{
    return htmlspecialchars((string) ($value ?? ''), ENT_QUOTES, 'UTF-8');
}

function siteBaseUrl(): string
{
    $raw = trim((string) (getenv('APP_PUBLIC_URL') ?: 'https://www.example.se'));
    return rtrim($raw !== '' ? $raw : 'https://www.example.se', '/');
}

function truncateMetaDescription(string $text, int $max = 158): string
{
    $plain = trim(html_entity_decode(strip_tags($text), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
    $t = preg_replace('/\s+/u', ' ', $plain) ?? '';
    if ($t === '') {
        return '';
    }
    if (mb_strlen($t) <= $max) {
        return $t;
    }
    $slice = mb_substr($t, 0, $max - 1);
    $lastSpace = mb_strrpos($slice, ' ');
    if ($lastSpace !== false && $lastSpace > 40) {
        $slice = mb_substr($slice, 0, $lastSpace);
    }

    return rtrim($slice, ',.;:–—- ') . '…';
}

function formatPriceAmount(float $amount, string $currency): string
{
    $code = trim($currency) !== '' ? trim($currency) : 'SEK';
    if (class_exists('NumberFormatter')) {
        $fmt = new NumberFormatter('sv_SE', NumberFormatter::CURRENCY);
        $formatted = $fmt->formatCurrency($amount, $code);
        if (is_string($formatted) && $formatted !== '') {
            return $formatted;
        }
    }

    return number_format($amount, 2, ',', ' ') . ' ' . $code;
}

function parsePriceListPath(): ?string
{
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
    if (preg_match('#^/price-list/([a-z0-9-]+)/?$#i', $path, $matches)) {
        return strtolower((string) $matches[1]);
    }

    return null;
}

/**
 * @return list<array<string, mixed>>
 */
function parsePriceListItems(array $item): array
{
    $raw = $item['items'] ?? null;
    if ($raw === null || $raw === '') {
        return [];
    }
    if (is_string($raw)) {
        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            return [];
        }
        $raw = $decoded;
    }
    if (!is_array($raw)) {
        return [];
    }
    $out = [];
    foreach ($raw as $i => $row) {
        if (!is_array($row)) {
            continue;
        }
        $title = (string) ($row['title'] ?? '');
        $category = trim((string) ($row['category'] ?? ''));
        $price = (float) ($row['price'] ?? 0);
        $out[] = [
            'id' => 'line-' . $i,
            'title' => $title,
            'description' => (string) ($row['description'] ?? ''),
            'price' => $price,
            'category' => $category,
        ];
    }

    return $out;
}

$baseUrl = siteBaseUrl();
$slug = parsePriceListPath();
$item = null;
$notFound = false;
$lines = [];
$currency = 'SEK';
$swishPayee = '';
$swishMessage = '';

if ($slug === null || $slug === '') {
    $notFound = true;
} else {
    try {
        $pdo = getPdoFromEnv();
        $q = publicAppPriceListBySlugSql($slug);
        $stmt = $pdo->prepare($q['sql']);
        $stmt->execute($q['params']);
        $row = $stmt->fetch();
        if ($row) {
            $item = $row;
            $lines = parsePriceListItems($row);
            $currency = trim((string) ($row['currency'] ?? 'SEK')) ?: 'SEK';
            $priceListId = (int) ($row['id'] ?? 0);
            if ($priceListId > 0) {
                $sq = publicAppSwishByPriceListIdSql($priceListId);
                $sstmt = $pdo->prepare($sq['sql']);
                $sstmt->execute($sq['params']);
                $srow = $sstmt->fetch();
                if ($srow) {
                    $swishPayee = trim((string) ($srow['payee'] ?? ''));
                    $swishMessage = trim((string) ($srow['message'] ?? ''));
                }
            }
        } else {
            $notFound = true;
        }
    } catch (Throwable $e) {
        $notFound = true;
    }
}

if ($notFound || !$item) {
    http_response_code(404);
    $title = 'Sidan hittades inte';
    $description = 'Prislistan finns inte eller är inte publikt.';
    $canonical = $baseUrl . '/price-lists/';
    $itemSlug = '';
} else {
    $title = (string) ($item['name'] ?? 'Prislista');
    $description = truncateMetaDescription((string) ($item['description'] ?? $title));
    if ($description === '') {
        $description = $title;
    }
    $itemSlug = trim((string) ($item['slug'] ?? $slug));
    $canonical = $baseUrl . '/price-list/' . ($itemSlug !== '' ? $itemSlug : $slug);
}

$jsonLd = [
    '@context' => 'https://schema.org',
    '@type' => 'WebPage',
    'name' => $title,
    'url' => $canonical,
    'description' => $description,
    'isPartOf' => [
        '@type' => 'WebSite',
        'name' => 'Clubdesk',
        'url' => $baseUrl . '/',
    ],
];

$grouped = [];
foreach ($lines as $line) {
    $cat = $line['category'] !== '' ? $line['category'] : 'Övrigt';
    if (!isset($grouped[$cat])) {
        $grouped[$cat] = [];
    }
    $grouped[$cat][] = $line;
}
?>
<!doctype html>
<html lang="sv">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title><?= h($title) ?></title>
    <meta name="description" content="<?= h($description) ?>" />
    <meta name="robots" content="<?= $notFound ? 'noindex, follow' : 'index, follow' ?>" />
    <link rel="canonical" href="<?= h($canonical) ?>" />
    <meta property="og:locale" content="sv_SE" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="<?= h($title) ?>" />
    <meta property="og:description" content="<?= h($description) ?>" />
    <meta property="og:url" content="<?= h($canonical) ?>" />
    <meta property="og:site_name" content="Clubdesk" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="<?= h($title) ?>" />
    <meta name="twitter:description" content="<?= h($description) ?>" />
    <link rel="stylesheet" href="/styles.css" />
    <script type="application/ld+json"><?= json_encode($jsonLd, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP) ?></script>
  </head>
  <body>
    <a class="skip-link" href="#main">Hoppa till innehåll</a>
    <div class="app-bg" aria-hidden="true"></div>

    <div class="app-shell">
      <div class="app-atmosphere" aria-hidden="true">
        <div class="app-atmosphere__grid"></div>
        <div class="app-atmosphere__blob app-atmosphere__blob--left"></div>
        <div class="app-atmosphere__blob app-atmosphere__blob--right"></div>
      </div>

      <header class="top-bar">
        <div class="top-bar__inner">
          <a class="brand" href="/">
            Clubdesk
            <span class="brand__dot" aria-hidden="true"></span>
          </a>
          <a class="detail-back-btn shadow-soft" href="/price-lists/" id="detail-back-btn" aria-label="Tillbaka">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Tillbaka
          </a>
        </div>
      </header>

<?php if ($item && !$notFound): ?>
<?php
    $listTitle = (string) ($item['name'] ?? 'Prislista');
?>
      <div class="step-subheader" id="price-list-subheader">
        <div class="step-subheader__inner step-subheader__inner--cart">
          <div class="step-subheader__cart-text">
            <p class="step-subheader__guide" id="price-list-subheader-label"><?= h($listTitle) ?></p>
            <p class="step-subheader__step step-subheader__total" id="price-list-subheader-info" aria-live="polite"><?= h(formatPriceAmount(0, $currency)) ?></p>
          </div>
          <button
            type="button"
            class="step-nav__btn step-nav__btn--next cart-toggle-btn is-disabled"
            id="cart-toggle-btn"
            disabled
            aria-disabled="true"
            aria-label="Visa varukorg"
          >
            <svg class="cart-toggle-btn__icon" data-icon="cart" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M6 6h15l-1.5 9H7.5L6 6z" />
              <path d="M6 6 5 3H2" />
              <circle cx="9" cy="20" r="1.25" fill="currentColor" stroke="none" />
              <circle cx="18" cy="20" r="1.25" fill="currentColor" stroke="none" />
            </svg>
          </button>
        </div>
      </div>
<?php endif; ?>

      <main id="main" class="app-main no-scrollbar">
<?php if ($notFound || !$item): ?>
        <article class="detail-article">
          <h1>Sidan hittades inte</h1>
          <p>Prislistan finns inte eller är inte publikt.</p>
          <a class="detail-back" href="/price-lists/" id="detail-back-not-found">Till prislistor</a>
        </article>
<?php else: ?>
        <div
          id="price-list-app"
          data-slug="<?= h($itemSlug !== '' ? $itemSlug : (string) $slug) ?>"
          data-currency="<?= h($currency) ?>"
          data-swish-payee="<?= h($swishPayee) ?>"
          data-swish-message="<?= h($swishMessage) ?>"
        >
          <div id="price-list-view">
            <article class="price-list-detail">
<?php if (!empty($item['description'])): ?>
              <p class="price-list-detail__lead"><?= h((string) $item['description']) ?></p>
<?php endif; ?>
<?php if ($lines === []): ?>
              <p class="empty-state">Inga rader i den här prislistan.</p>
<?php else: ?>
<?php foreach ($grouped as $catName => $catLines): ?>
              <section class="price-list-section">
                <h2 class="price-list-section__title"><?= h((string) $catName) ?></h2>
                <ul class="price-list-rows">
<?php foreach ($catLines as $line): ?>
                  <li
                    class="price-list-row"
                    data-line-id="<?= h((string) $line['id']) ?>"
                    data-title="<?= h((string) $line['title']) ?>"
                    data-price="<?= h((string) $line['price']) ?>"
                    data-category="<?= h((string) ($line['category'] !== '' ? $line['category'] : 'Övrigt')) ?>"
                  >
                    <div class="price-list-row__main">
                      <div class="price-list-row__text">
                        <p class="price-list-row__title"><?= h($line['title']) ?></p>
                      </div>
                      <div class="price-list-row__actions">
                        <p class="price-list-row__price"><?= h(formatPriceAmount((float) $line['price'], $currency)) ?></p>
                        <button type="button" class="price-list-qty-btn price-list-qty-btn--plus" data-cart-add aria-label="Lägg till">
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
                            <path d="M12 5v14M5 12h14" />
                          </svg>
                        </button>
                      </div>
                    </div>
<?php if ($line['description'] !== ''): ?>
                    <p class="price-list-row__desc"><?= h($line['description']) ?></p>
<?php endif; ?>
                  </li>
<?php endforeach; ?>
                </ul>
              </section>
<?php endforeach; ?>
<?php endif; ?>
            </article>
          </div>

          <div id="cart-view" hidden>
            <article class="price-list-detail cart-detail">
              <div id="cart-body"></div>
              <h2 class="price-list-section__title cart-pay__title">Att betala</h2>
              <p class="cart-total" id="cart-total" aria-live="polite"><?= h(formatPriceAmount(0, $currency)) ?></p>
              <div class="cart-swish" id="cart-swish" hidden>
                <img class="cart-swish__qr" id="cart-swish-qr" alt="Swish QR-kod" width="256" height="256" />
                <p class="cart-swish__number" id="cart-swish-number"></p>
              </div>
            </article>
          </div>
        </div>
<?php endif; ?>
      </main>

      <nav class="bottom-bar" aria-label="Sidnavigering">
        <div class="bottom-bar__inner glass shadow-float">
          <a class="bottom-bar__tab" href="/" data-tab="home">
            <svg class="bottom-bar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-10.5z" />
            </svg>
            <span class="bottom-bar__label">Hem</span>
            <span class="bottom-bar__dot" aria-hidden="true"></span>
          </a>
          <a class="bottom-bar__tab" href="/guides/" data-tab="guides">
            <svg class="bottom-bar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
            </svg>
            <span class="bottom-bar__label">Guides</span>
            <span class="bottom-bar__dot" aria-hidden="true"></span>
          </a>
          <a class="bottom-bar__tab is-active" href="/price-lists/" data-tab="price-lists">
            <svg class="bottom-bar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h10" />
              <path d="M18 15v6M15 18h6" />
            </svg>
            <span class="bottom-bar__label">Price list</span>
            <span class="bottom-bar__dot" aria-hidden="true"></span>
          </a>
          <a class="bottom-bar__tab" href="/info/" data-tab="info">
            <svg class="bottom-bar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 10v6M12 7h.01" />
            </svg>
            <span class="bottom-bar__label">Info</span>
            <span class="bottom-bar__dot" aria-hidden="true"></span>
          </a>
        </div>
      </nav>
    </div>
<?php if ($item && !$notFound): ?>
    <script src="/lib/priceListCart.js"></script>
    <script src="/lib/swishPayload.js"></script>
    <script src="/lib/qrcode.bundle.js"></script>
    <script src="/price-list-cart-app.js" defer></script>
<?php endif; ?>
    <script>
      (function () {
        function bindBackNav(el) {
          if (!el) return;
          el.addEventListener('click', function (e) {
            if (window.history.length > 1) {
              e.preventDefault();
              window.history.back();
            }
          });
        }
        bindBackNav(document.getElementById('detail-back-btn'));
        bindBackNav(document.getElementById('detail-back-not-found'));
      })();
    </script>
  </body>
</html>

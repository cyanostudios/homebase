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

$baseUrl = siteBaseUrl();
$swishPayee = '';
$swishMessage = '';
$loadError = false;

try {
    $pdo = getPdoFromEnv();
    $q = publicAppPrimarySwishProfileSql();
    $stmt = $pdo->prepare($q['sql']);
    $stmt->execute($q['params']);
    $row = $stmt->fetch();
    if ($row) {
        $swishPayee = trim((string) ($row['payee'] ?? ''));
        $swishMessage = trim((string) ($row['message'] ?? ''));
    }
} catch (Throwable $e) {
    $loadError = true;
}

$hasPayee = $swishPayee !== '';
$title = 'Swish';
$description = $hasPayee
    ? 'Föreningens Swish-nummer och QR-kod.'
    : 'Swish-nummer saknas.';
$canonical = $baseUrl . '/swish/';

$jsonLd = [
    '@context' => 'https://schema.org',
    '@type' => 'WebPage',
    'name' => $title,
    'description' => $description,
    'url' => $canonical,
];
?>
<!DOCTYPE html>
<html lang="sv">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title><?= h($title) ?> · Clubdesk</title>
    <meta name="description" content="<?= h($description) ?>" />
    <link rel="canonical" href="<?= h($canonical) ?>" />
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

    <div class="app-shell app-shell--guide">
      <header class="guide-header">
        <div class="guide-header__copy">
          <h1 class="guide-header__title"><?= h($title) ?></h1>
          <p class="home-header__text guide-header__text">Skanna QR-koden eller ange numret i Swish.</p>
        </div>
        <a class="guide-back-btn" href="/" id="detail-back-btn" aria-label="Tillbaka">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </a>
      </header>

      <main id="main" class="app-main no-scrollbar">
        <div class="home-sheet swish-sheet">
<?php if ($loadError): ?>
          <div class="empty-state empty-state--inset">Kunde inte hämta Swish just nu.</div>
<?php elseif (!$hasPayee): ?>
          <div class="empty-state empty-state--inset">Inget Swish-nummer är konfigurerat ännu.</div>
<?php else: ?>
          <div
            class="org-swish"
            id="org-swish"
            data-swish-payee="<?= h($swishPayee) ?>"
            data-swish-message="<?= h($swishMessage) ?>"
          >
            <img class="cart-swish__qr org-swish__qr" id="org-swish-qr" alt="Swish QR-kod" width="256" height="256" hidden />
            <p class="cart-swish__number org-swish__number" id="org-swish-number"></p>
            <p class="org-swish__hint">Beloppet anger du i Swish-appen.</p>
          </div>
<?php endif; ?>
        </div>
      </main>

      <nav class="bottom-bar" aria-label="Sidnavigering">
        <div class="bottom-bar__inner">
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
          <a class="bottom-bar__tab" href="/price-lists/" data-tab="price-lists">
            <svg class="bottom-bar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h10" />
              <path d="M18 15v6M15 18h6" />
            </svg>
            <span class="bottom-bar__label">Price list</span>
            <span class="bottom-bar__dot" aria-hidden="true"></span>
          </a>
        </div>
      </nav>
    </div>

<?php if ($hasPayee): ?>
    <script src="/lib/swishPayload.js"></script>
    <script src="/lib/qrcode.bundle.js"></script>
    <script src="/swish-page-app.js"></script>
<?php endif; ?>
  </body>
</html>

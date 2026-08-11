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

function kontaktDisplayName(array $row): string
{
    $company = trim((string) ($row['company_name'] ?? ''));
    if ($company !== '') {
        return $company;
    }
    $persons = $row['contact_persons'] ?? null;
    if (is_string($persons)) {
        $decoded = json_decode($persons, true);
        $persons = is_array($decoded) ? $decoded : [];
    }
    if (is_array($persons) && isset($persons[0]) && is_array($persons[0])) {
        $name = trim((string) ($persons[0]['name'] ?? $persons[0]['fullName'] ?? ''));
        if ($name !== '') {
            return $name;
        }
    }
    return 'Kontakt';
}

$baseUrl = siteBaseUrl();
$contacts = [];
$loadError = false;

try {
    $pdo = getPdoFromEnv();
    $sql = publicAppInfoContactsSql($pdo);
    if ($sql !== null) {
        $stmt = $pdo->query($sql);
        $contacts = $stmt->fetchAll();
    }
} catch (Throwable $e) {
    $loadError = true;
}

$hasContacts = count($contacts) > 0;
$title = 'Kontakt';
$description = $hasContacts
    ? 'Kontaktpersoner för föreningen.'
    : 'Inga kontakter publicerade ännu.';
$canonical = $baseUrl . '/kontakt/';

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
          <p class="home-header__text guide-header__text">Personer att höra av dig till.</p>
        </div>
        <a class="guide-back-btn" href="/" id="detail-back-btn" aria-label="Tillbaka">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </a>
      </header>

      <main id="main" class="app-main no-scrollbar">
        <div class="home-sheet kontakt-sheet">
<?php if ($loadError): ?>
          <div class="empty-state empty-state--inset">Kunde inte hämta kontakter just nu.</div>
<?php elseif (!$hasContacts): ?>
          <div class="empty-state empty-state--inset">Inga kontakter är tillagda ännu.</div>
<?php else: ?>
          <ul class="kontakt-list" aria-label="Kontakter">
<?php foreach ($contacts as $row):
    $name = kontaktDisplayName($row);
    $blurb = trim((string) ($row['blurb'] ?? ''));
    $phone = trim((string) ($row['phone'] ?? ''));
    $email = trim((string) ($row['email'] ?? ''));
?>
            <li class="kontakt-card">
              <div class="kontakt-card__name"><?= h($name) ?></div>
<?php if ($blurb !== ''): ?>
              <p class="kontakt-card__blurb"><?= h($blurb) ?></p>
<?php endif; ?>
              <div class="kontakt-card__meta">
<?php if ($phone !== ''): ?>
                <a class="kontakt-card__link" href="tel:<?= h(preg_replace('/\s+/', '', $phone) ?? $phone) ?>"><?= h($phone) ?></a>
<?php endif; ?>
<?php if ($email !== ''): ?>
                <a class="kontakt-card__link" href="mailto:<?= h($email) ?>"><?= h($email) ?></a>
<?php endif; ?>
              </div>
            </li>
<?php endforeach; ?>
          </ul>
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
  </body>
</html>

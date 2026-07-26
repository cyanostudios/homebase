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

function absolutePublicUrl(string $baseUrl, string $url): string
{
    $url = trim($url);
    if ($url === '') {
        return '';
    }
    if (str_starts_with($url, 'http://') || str_starts_with($url, 'https://')) {
        return $url;
    }
    if (str_starts_with($url, '//')) {
        return 'https:' . $url;
    }
    $baseUrl = rtrim($baseUrl, '/');
    if (str_starts_with($url, '/')) {
        return $baseUrl . $url;
    }

    return $url;
}

function truncateMetaDescription(string $text, int $max = 158): string
{
    $t = preg_replace('/\s+/u', ' ', trim($text)) ?? '';
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

function parseItemPath(): ?string
{
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
    if (preg_match('#^/item/([a-z0-9-]+)/?$#i', $path, $matches)) {
        return strtolower((string) $matches[1]);
    }

    return null;
}

/**
 * Optional JSON steps column: [{ "number": 1, "title": "...", "description": "...", "image": "..." }, ...]
 *
 * @return list<array<string, mixed>>
 */
function parseItemSteps(array $item): array
{
    $raw = $item['steps'] ?? null;
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
    foreach ($raw as $i => $step) {
        if (!is_array($step)) {
            continue;
        }
        $out[] = [
            'number' => (int) ($step['number'] ?? ($i + 1)),
            'title' => (string) ($step['title'] ?? ('Steg ' . ($i + 1))),
            'description' => (string) ($step['description'] ?? ''),
            'image' => (string) ($step['image'] ?? $step['image_url'] ?? ''),
        ];
    }

    return $out;
}

$baseUrl = siteBaseUrl();
$slug = parseItemPath();
$item = null;
$notFound = false;
$steps = [];

if ($slug === null || $slug === '') {
    $notFound = true;
} else {
    try {
        $pdo = getPdoFromEnv();
        $q = publicAppItemBySlugSql($pdo, $slug);
        $stmt = $pdo->prepare($q['sql']);
        $stmt->execute($q['params']);
        $row = $stmt->fetch();
        if ($row) {
            $item = $row;
            $steps = parseItemSteps($row);
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
    $description = 'Objektet finns inte eller är inte publikt.';
    $canonical = $baseUrl . '/';
    $ogImage = '';
} else {
    $title = (string) ($item['name'] ?? 'Item');
    $description = truncateMetaDescription((string) ($item['description'] ?? $title));
    if ($description === '') {
        $description = $title;
    }
    $itemSlug = trim((string) ($item['slug'] ?? $slug));
    $canonical = $baseUrl . '/item/' . ($itemSlug !== '' ? $itemSlug : $slug);
    $ogImage = absolutePublicUrl($baseUrl, (string) ($item['featured_image_url'] ?? ''));
}

$jsonLd = [
    '@context' => 'https://schema.org',
    '@type' => 'WebPage',
    'name' => $title,
    'url' => $canonical,
    'description' => $description,
    'isPartOf' => [
        '@type' => 'WebSite',
        'name' => 'Public App',
        'url' => $baseUrl . '/',
    ],
];

$showAudio = $steps !== [];
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
    <meta property="og:site_name" content="Public App" />
<?php if ($ogImage !== ''): ?>
    <meta property="og:image" content="<?= h($ogImage) ?>" />
<?php endif; ?>
    <meta name="twitter:card" content="summary_large_image" />
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
            Public App
            <span class="brand__dot" aria-hidden="true"></span>
          </a>
          <a class="detail-back-btn shadow-soft" href="/" aria-label="Till startsidan">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Tillbaka
          </a>
        </div>
      </header>

      <main id="main" class="app-main no-scrollbar">
<?php if ($notFound || !$item): ?>
        <article class="detail-article">
          <h1>Sidan hittades inte</h1>
          <p>Objektet finns inte eller är inte publikt.</p>
          <a class="detail-back" href="/">Till startsidan</a>
        </article>
<?php elseif ($steps !== []): ?>
        <div class="step-swipe no-scrollbar" id="step-swipe">
<?php foreach ($steps as $step): ?>
<?php
    $stepImg = absolutePublicUrl($baseUrl, (string) ($step['image'] ?? ''));
    if ($stepImg === '' && $ogImage !== '') {
        $stepImg = $ogImage;
    }
    $num = (int) ($step['number'] ?? 1);
?>
          <article class="step-slide scroll-snap-center">
            <div class="step-slide__media">
<?php if ($stepImg !== ''): ?>
              <img class="kenburns" src="<?= h($stepImg) ?>" alt="" />
<?php endif; ?>
              <div class="step-slide__fade" aria-hidden="true"></div>
              <span class="step-slide__number"><?= $num ?></span>
            </div>
            <div class="step-slide__sheet">
              <div class="step-slide__handle" aria-hidden="true"></div>
              <h2 class="step-slide__title"><?= h((string) ($step['title'] ?? '')) ?></h2>
<?php if (!empty($step['description'])): ?>
              <p class="step-slide__desc"><?= h((string) $step['description']) ?></p>
<?php endif; ?>
            </div>
          </article>
<?php endforeach; ?>
        </div>
<?php else: ?>
        <article class="detail-article">
<?php if ($ogImage !== ''): ?>
          <img class="detail-hero" src="<?= h($ogImage) ?>" alt="" />
<?php endif; ?>
          <h1><?= h((string) ($item['name'] ?? '')) ?></h1>
<?php if (!empty($item['description'])): ?>
          <p><?= h((string) $item['description']) ?></p>
<?php endif; ?>
          <a class="detail-back" href="/">← Tillbaka</a>
        </article>
<?php endif; ?>
      </main>

<?php if ($showAudio && $item): ?>
      <div class="audio-pod" id="audio-pod">
        <div class="audio-pod__inner glass shadow-float">
<?php if ($ogImage !== ''): ?>
          <img class="audio-pod__thumb" src="<?= h($ogImage) ?>" alt="" width="48" height="48" />
<?php else: ?>
          <div class="audio-pod__thumb" aria-hidden="true"></div>
<?php endif; ?>
          <div class="audio-pod__text">
            <p class="audio-pod__eyebrow">Steg för steg</p>
            <p class="audio-pod__title"><?= h((string) ($item['name'] ?? 'Ljudguide')) ?></p>
          </div>
          <button type="button" class="audio-pod__play shadow-soft" aria-label="Spela" disabled>
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
          </button>
        </div>
      </div>
<?php endif; ?>

      <nav class="bottom-bar" aria-label="Sidnavigering">
        <div class="bottom-bar__inner glass shadow-float">
          <a class="bottom-bar__tab" href="/" data-tab="home">
            <svg class="bottom-bar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-10.5z" />
            </svg>
            <span class="bottom-bar__label">Hem</span>
            <span class="bottom-bar__dot" aria-hidden="true"></span>
          </a>
          <a class="bottom-bar__tab" href="/#all" data-tab="all">
            <svg class="bottom-bar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
            </svg>
            <span class="bottom-bar__label">Alla</span>
            <span class="bottom-bar__dot" aria-hidden="true"></span>
          </a>
          <a class="bottom-bar__tab" href="/#favourites" data-tab="favourites">
            <svg class="bottom-bar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M12 21s-7-4.5-9.5-8.2C.7 10 2.2 6.5 5.5 6c1.7-.3 3.3.5 4.1 1.8C10.4 6.5 12 5.7 13.7 6c3.3.5 4.8 4 3 6.8C19 16.5 12 21 12 21z" />
            </svg>
            <span class="bottom-bar__label">Favoriter</span>
            <span class="bottom-bar__dot" aria-hidden="true"></span>
          </a>
          <a class="bottom-bar__tab" href="/#info" data-tab="info">
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
  </body>
</html>

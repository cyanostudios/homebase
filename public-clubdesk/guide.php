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

/**
 * Safe HTML for step body: allowlist tags, strip attributes.
 * Legacy plain text is escaped with preserved newlines.
 */
function renderInstructionBodyHtml(string $raw): string
{
    $trimmed = trim($raw);
    if ($trimmed === '') {
        return '';
    }
    if (!str_starts_with($trimmed, '<')) {
        return nl2br(h($trimmed), false);
    }
    $clean = strip_tags(
        $trimmed,
        '<p><br><ul><ol><li><strong><em><b><i><u><s>',
    );
    $clean = preg_replace('/<(\/?)([a-z0-9]+)(\s[^>]*)?>/i', '<$1$2>', $clean) ?? '';

    return $clean;
}

function parseGuidePath(): ?string
{
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
    if (preg_match('#^/guide/([a-z0-9-]+)/?$#i', $path, $matches)) {
        return strtolower((string) $matches[1]);
    }

    return null;
}

function slugifyCategory(string $value): string
{
    $v = mb_strtolower(trim($value), 'UTF-8');
    $v = strtr($v, [
        'å' => 'a',
        'ä' => 'a',
        'ö' => 'o',
        'é' => 'e',
        'è' => 'e',
        'ü' => 'u',
    ]);
    $v = preg_replace('/[^a-z0-9]+/u', '-', $v) ?? '';

    return trim($v, '-') ?: 'ovrigt';
}

function categoryListingPath(string $category): string
{
    return '/kategori/' . slugifyCategory($category) . '/';
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
$slug = parseGuidePath();
$item = null;
$notFound = false;
$steps = [];
$guideCategory = 'Övrigt';

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
            $catRaw = trim((string) ($row['category'] ?? ''));
            if ($catRaw === '') {
                $guideCategory = 'Övrigt';
            } else {
                $first = trim(explode(',', $catRaw, 2)[0]);
                $guideCategory = $first !== '' ? $first : 'Övrigt';
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
    $canonical = $baseUrl . '/guide/' . ($itemSlug !== '' ? $itemSlug : $slug);
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
        'name' => 'Clubdesk',
        'url' => $baseUrl . '/',
    ],
];

$showProgress = $steps !== [];
$totalSteps = count($steps);
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
            Clubdesk
            <span class="brand__dot" aria-hidden="true"></span>
          </a>
          <a class="detail-back-btn shadow-soft" href="/" id="detail-back-btn" aria-label="Tillbaka">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Tillbaka
          </a>
        </div>
      </header>

<?php if ($showProgress && $item): ?>
<?php
    $guideTitle = (string) ($item['name'] ?? 'Guide');
    $firstStepTitle = (string) ($steps[0]['title'] ?? 'Steg 1');
?>
      <div class="step-subheader" id="progress-pod" data-progress-pod>
        <div class="step-subheader__inner">
          <p class="step-subheader__guide" id="progress-guide"><?= h($guideTitle) ?></p>
          <p class="step-subheader__step" id="progress-step" aria-live="polite"><?= h($firstStepTitle) ?></p>
          <div class="step-subheader__meta">
            <span class="step-subheader__count" id="progress-eyebrow">Steg 1 av <?= (int) $totalSteps ?></span>
            <div class="step-subheader__bar" aria-hidden="true">
              <span class="step-subheader__fill" id="progress-fill" style="width: <?= $totalSteps > 0 ? (100 / $totalSteps) : 0 ?>%"></span>
            </div>
          </div>
        </div>
      </div>
<?php endif; ?>

      <main id="main" class="app-main no-scrollbar">
<?php if ($notFound || !$item): ?>
        <article class="detail-article">
          <h1>Sidan hittades inte</h1>
          <p>Guiden finns inte eller är inte publikt.</p>
          <a class="detail-back" href="/" id="detail-back-not-found">Till startsidan</a>
        </article>
<?php elseif ($steps !== []): ?>
        <div class="step-swipe no-scrollbar" id="step-swipe" data-step-total="<?= (int) $totalSteps ?>">
<?php foreach ($steps as $step): ?>
<?php
    $stepImg = absolutePublicUrl($baseUrl, (string) ($step['image'] ?? ''));
    if ($stepImg === '' && $ogImage !== '') {
        $stepImg = $ogImage;
    }
    $num = (int) ($step['number'] ?? 1);
?>
          <article class="step-slide scroll-snap-center" data-step-index="<?= $num ?>" data-step-title="<?= h((string) ($step['title'] ?? '')) ?>">
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
              <div class="step-slide__desc"><?= renderInstructionBodyHtml((string) $step['description']) ?></div>
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
          <a class="detail-back" href="/" id="detail-back-empty">← Tillbaka</a>
        </article>
<?php endif; ?>
      </main>

<?php if ($showProgress && $item): ?>
      <div class="step-nav" id="step-nav" role="group" aria-label="Stegnavigering">
        <button type="button" class="step-nav__btn step-nav__btn--prev" id="step-prev" aria-label="Föregående steg" disabled>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <button type="button" class="step-nav__btn step-nav__btn--next" id="step-next" aria-label="Nästa steg">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
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
    <script>
      (function () {
        /** Prefer browser history so Tillbaka returns to previous listing (e.g. category). */
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
        bindBackNav(document.getElementById('detail-back-empty'));

        var guideCategory = <?= json_encode($guideCategory, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?>;
        var categoryPath = <?= json_encode(categoryListingPath($guideCategory), JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?>;

        function goToGuidesListing() {
          window.location.href = categoryPath || '/guides/';
        }

        var swipe = document.getElementById('step-swipe');
        var stepLabel = document.getElementById('progress-step');
        var countLabel = document.getElementById('progress-eyebrow');
        var fill = document.getElementById('progress-fill');
        var prevBtn = document.getElementById('step-prev');
        var nextBtn = document.getElementById('step-next');
        if (!swipe || !stepLabel) return;

        var total = Math.max(1, Number(swipe.getAttribute('data-step-total') || 1));
        var slides = Array.prototype.slice.call(swipe.querySelectorAll('.step-slide'));
        var current = 1;
        var scrollingProgrammatically = false;

        function goTo(index) {
          var i = Math.max(0, Math.min(slides.length - 1, index));
          var slide = slides[i];
          if (!slide) return;
          scrollingProgrammatically = true;
          slide.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
          setCurrent(i + 1);
          window.setTimeout(function () {
            scrollingProgrammatically = false;
          }, 400);
        }

        function setCurrent(n) {
          current = n;
          var slide = slides[current - 1];
          var stepTitle = slide
            ? (slide.getAttribute('data-step-title') || ('Steg ' + current))
            : ('Steg ' + current);
          stepLabel.textContent = stepTitle;
          if (countLabel) {
            countLabel.textContent = 'Steg ' + current + ' av ' + total;
          }
          if (fill) {
            fill.style.width = Math.round((current / total) * 100) + '%';
          }
          if (prevBtn) {
            prevBtn.disabled = current <= 1;
          }
          if (nextBtn) {
            var isLast = current >= total;
            nextBtn.innerHTML = isLast
              ? '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>'
              : '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>';
            nextBtn.classList.toggle('step-nav__btn--done', isLast);
            nextBtn.setAttribute('aria-label', isLast ? 'Klart, tillbaka till kategorin' : 'Nästa steg');
          }
        }

        function updateFromScroll() {
          if (scrollingProgrammatically) return;
          var center = swipe.scrollLeft + swipe.clientWidth / 2;
          var best = 1;
          var bestDist = Infinity;
          slides.forEach(function (slide, i) {
            var mid = slide.offsetLeft + slide.offsetWidth / 2;
            var dist = Math.abs(mid - center);
            if (dist < bestDist) {
              bestDist = dist;
              best = i + 1;
            }
          });
          setCurrent(best);
        }

        if (prevBtn) {
          prevBtn.addEventListener('click', function () {
            if (current > 1) goTo(current - 2);
          });
        }
        if (nextBtn) {
          nextBtn.addEventListener('click', function () {
            if (current >= total) {
              goToGuidesListing();
              return;
            }
            goTo(current);
          });
        }

        document.addEventListener('keydown', function (e) {
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault();
            if (current < total) goTo(current);
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (current > 1) goTo(current - 2);
          }
        });

        swipe.addEventListener('scroll', updateFromScroll, { passive: true });
        setCurrent(1);
      })();
    </script>
  </body>
</html>

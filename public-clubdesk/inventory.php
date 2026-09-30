<?php
declare(strict_types=1);

require_once __DIR__ . '/api/pdo_env.php';
require_once __DIR__ . '/api/db_helpers.php';
require_once __DIR__ . '/api/security_headers.php';
require_once __DIR__ . '/api/pwa_head.php';
require_once __DIR__ . '/api/branding_helpers.php';
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

function formatPriceAmount(?float $amount, string $currency): string
{
    if ($amount === null) {
        return '';
    }
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

function parseInventoryPath(): ?string
{
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
    if (preg_match('#^/inventory/([a-z0-9-]+)/?$#i', $path, $matches)) {
        return strtolower((string) $matches[1]);
    }

    return null;
}

/**
 * @return list<array<string, mixed>>
 */
function parseInventoryVariants(array $row): array
{
    $raw = $row['variants'] ?? '[]';
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
    foreach ($raw as $i => $variant) {
        if (!is_array($variant)) {
            continue;
        }
        $out[] = [
            'id' => (int) ($variant['id'] ?? 0),
            'sku' => trim((string) ($variant['sku'] ?? '')),
            'gtin' => preg_replace('/\s+/', '', (string) ($variant['gtin'] ?? '')) ?? '',
            'audience' => trim((string) ($variant['audience'] ?? '')),
            'color' => trim((string) ($variant['color'] ?? '')),
            'size' => trim((string) ($variant['size'] ?? '')),
            'quantity' => (int) ($variant['quantity'] ?? 0),
            'sortOrder' => (int) ($variant['sortOrder'] ?? $i),
        ];
    }
    usort($out, static fn ($a, $b) => ($a['sortOrder'] <=> $b['sortOrder']) ?: strcmp($a['sku'], $b['sku']));

    return $out;
}

function variantLabel(array $variant): string
{
    $parts = array_filter([
        (string) ($variant['audience'] ?? ''),
        (string) ($variant['color'] ?? ''),
        (string) ($variant['size'] ?? ''),
    ], static fn ($p) => trim($p) !== '');
    if ($parts !== []) {
        return implode(' · ', $parts);
    }
    $sku = trim((string) ($variant['sku'] ?? ''));

    return $sku !== '' ? $sku : 'Variant';
}

function cellText(array $row, string $key): string
{
    $value = $row[$key] ?? null;
    if ($value === null) {
        return '';
    }

    return trim((string) $value);
}

function formatNutritionAmount(array $row, string $key, string $unit): string
{
    $raw = $row[$key] ?? null;
    if ($raw === null || $raw === '' || !is_numeric($raw)) {
        return '';
    }
    $num = (float) $raw;
    $decimals = abs($num - round($num)) < 0.00001 ? 0 : 1;
    $formatted = number_format($num, $decimals, ',', '');

    return $formatted . ' ' . $unit;
}

/**
 * @param list<array{label: string, value: string}> $rows
 */
function renderFactList(array $rows): void
{
    if ($rows === []) {
        return;
    }
    echo '<dl class="inventory-facts">';
    foreach ($rows as $row) {
        echo '<div class="inventory-facts__row">';
        echo '<dt class="inventory-facts__label">' . h($row['label']) . '</dt>';
        echo '<dd class="inventory-facts__value">' . nl2br(h($row['value']), false) . '</dd>';
        echo '</div>';
    }
    echo '</dl>';
}

$baseUrl = siteBaseUrl();
$slug = parseInventoryPath();
$item = null;
$notFound = false;
$variants = [];
$currency = 'SEK';
$ogImage = '';

if ($slug === null || $slug === '') {
    $notFound = true;
} else {
    try {
        $pdo = getPdoFromEnv();
        if (!publicAppCardVisible($pdo, 'inventory')) {
            $notFound = true;
        } else {
            $q = publicAppInventoryBySlugSql($pdo, $slug);
            $stmt = $pdo->prepare($q['sql']);
            $stmt->execute($q['params']);
            $row = $stmt->fetch();
            if ($row) {
                $item = $row;
                $variants = parseInventoryVariants($row);
                $currency = trim((string) ($row['currency'] ?? 'SEK')) ?: 'SEK';
                $featured = trim((string) ($row['featured_image_url'] ?? ''));
                if ($featured !== '') {
                    $ogImage = absolutePublicUrl($baseUrl, $featured);
                }
            } else {
                $notFound = true;
            }
        }
    } catch (Throwable $e) {
        $notFound = true;
    }
}

if ($notFound || !$item) {
    http_response_code(404);
    $title = 'Sidan hittades inte';
    $description = 'Artikeln finns inte eller är inte publikt.';
    $canonical = $baseUrl . '/inventory/';
    $itemSlug = '';
} else {
    $articleName = trim((string) ($item['article_name'] ?? ''));
    $title = $articleName !== '' ? $articleName : 'Artikel';
    $brand = trim((string) ($item['brand'] ?? ''));
    $descRaw = trim((string) ($item['description'] ?? ''));
    $material = trim((string) ($item['material'] ?? ''));
    $metaParts = array_filter([$brand, $material], static fn ($p) => $p !== '');
    $description = truncateMetaDescription($descRaw !== '' ? $descRaw : implode(' · ', $metaParts));
    if ($description === '') {
        $description = $title;
    }
    $itemSlug = trim((string) ($item['slug'] ?? $slug));
    $canonical = $baseUrl . '/inventory/' . ($itemSlug !== '' ? $itemSlug : $slug);
}

$recommended = null;
$sale = null;
if ($item) {
    $recRaw = $item['recommended_price'] ?? null;
    $saleRaw = $item['sale_price'] ?? null;
    $recommended = $recRaw !== null && $recRaw !== '' ? (float) $recRaw : null;
    $sale = $saleRaw !== null && $saleRaw !== '' ? (float) $saleRaw : null;
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
?>
<!doctype html>
<html lang="sv">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title><?= h($title) ?></title>
    <meta name="description" content="<?= h($description) ?>" />
<?php publicClubdeskPwaHeadTags(); ?>
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

    <div class="app-shell app-shell--guide">
<?php publicAppRenderTopBar(); ?>
<?php if ($item && !$notFound): ?>
<?php
    $articleTitle = (string) ($item['article_name'] ?? 'Artikel');
    $brandLine = trim((string) ($item['brand'] ?? ''));
    $headerDesc = trim((string) ($item['description'] ?? ''));
?>
      <header class="guide-header">
        <div class="guide-header__copy">
          <h1 class="guide-header__title"><?= h($articleTitle) ?></h1>
<?php if ($brandLine !== ''): ?>
          <p class="home-header__text guide-header__text"><?= h($brandLine) ?></p>
<?php elseif ($headerDesc !== ''): ?>
          <p class="home-header__text guide-header__text"><?= h(truncateMetaDescription($headerDesc, 120)) ?></p>
<?php endif; ?>
        </div>
        <a class="guide-back-btn" href="/inventory/" id="detail-back-btn" aria-label="Tillbaka">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </a>
      </header>
<?php endif; ?>

      <main id="main" class="app-main no-scrollbar">
<?php if ($notFound || !$item): ?>
        <article class="detail-article">
          <h1>Sidan hittades inte</h1>
          <p>Artikeln finns inte eller är inte publikt.</p>
          <a class="detail-back" href="/inventory/" id="detail-back-not-found">Till inventarie</a>
        </article>
<?php else: ?>
        <div id="inventory-app" class="home-sheet" data-slug="<?= h($itemSlug) ?>">
<?php if ($ogImage !== ''): ?>
          <img class="detail-hero" src="<?= h($ogImage) ?>" alt="" />
<?php endif; ?>
<?php
    $bodyDesc = cellText($item, 'description');
    $packageSize = cellText($item, 'package_size');
    $packageUnit = cellText($item, 'package_unit');
    $packageLabel = trim($packageSize . ($packageSize !== '' && $packageUnit !== '' ? ' ' : '') . $packageUnit);
    $factRows = [];
    $pushFact = static function (string $label, string $value) use (&$factRows): void {
        if ($value !== '') {
            $factRows[] = ['label' => $label, 'value' => $value];
        }
    };
    $pushFact('Varumärke', cellText($item, 'brand'));
    $pushFact('Produktkategori', cellText($item, 'category'));
    $pushFact('Förpackningsstorlek', $packageLabel);
    $pushFact('Artikel-GTIN', cellText($item, 'gtin'));
    $pushFact('Artikelnummer', cellText($item, 'article_number'));
    $pushFact('Nettovikt', cellText($item, 'net_content'));
    $pushFact('Material', cellText($item, 'material'));
    $pushFact('Ursprungsland', cellText($item, 'country_of_origin'));
    $pushFact('Tillverkningsland', cellText($item, 'country_of_manufacture'));
    $pushFact('Leverantör', cellText($item, 'supplier'));
    if ($recommended !== null) {
        $pushFact('Rek. pris', formatPriceAmount($recommended, $currency));
    }
    if ($sale !== null) {
        $pushFact('Försäljningspris', formatPriceAmount($sale, $currency));
    }
    $tagRaw = $item['tags'] ?? [];
    if (is_string($tagRaw)) {
        $decodedTags = json_decode($tagRaw, true);
        $tagRaw = is_array($decodedTags) ? $decodedTags : [];
    }
    $tagLabels = [];
    if (is_array($tagRaw)) {
        foreach ($tagRaw as $tag) {
            $label = trim((string) $tag);
            if ($label !== '') {
                $tagLabels[] = $label;
            }
        }
    }
    $pushFact('Taggar', implode(', ', $tagLabels));
    $ingredients = cellText($item, 'ingredients');
    $allergens = cellText($item, 'allergens');
    $nutritionRows = [];
    $pushNutrition = static function (string $label, string $key, string $unit) use (&$nutritionRows, $item): void {
        $formatted = formatNutritionAmount($item, $key, $unit);
        if ($formatted !== '') {
            $nutritionRows[] = ['label' => $label, 'value' => $formatted];
        }
    };
    $pushNutrition('Energi', 'energy_kcal_100g', 'kcal');
    $pushNutrition('Fett', 'fat_g_100g', 'g');
    $pushNutrition('Mättat fett', 'saturated_fat_g_100g', 'g');
    $pushNutrition('Kolhydrat', 'carbohydrate_g_100g', 'g');
    $pushNutrition('Socker', 'sugar_g_100g', 'g');
    $pushNutrition('Protein', 'protein_g_100g', 'g');
    $pushNutrition('Salt', 'salt_g_100g', 'g');
    $stockRows = $variants !== [] ? $variants : [[
        'id' => 0,
        'audience' => '',
        'color' => '',
        'size' => '',
        'sku' => '',
        'gtin' => '',
        'quantity' => 0,
    ]];
    $stockTotal = 0;
    foreach ($stockRows as $stockRow) {
        $stockTotal += (int) ($stockRow['quantity'] ?? 0);
    }
?>
<?php if ($bodyDesc !== '' || $factRows !== []): ?>
          <section class="home-section">
<?php if ($bodyDesc !== ''): ?>
            <p class="option-card__desc price-list-row__desc"><?= nl2br(h($bodyDesc), false) ?></p>
<?php endif; ?>
<?php renderFactList($factRows); ?>
          </section>
<?php endif; ?>
<?php if ($ingredients !== '' || $allergens !== '' || $nutritionRows !== []): ?>
          <section class="home-section">
            <h2 class="home-section__title">Ingredienser &amp; näringsvärde</h2>
<?php if ($ingredients !== ''): ?>
            <p class="option-card__desc price-list-row__desc"><?= nl2br(h($ingredients), false) ?></p>
<?php endif; ?>
<?php if ($allergens !== ''): ?>
            <p class="inventory-facts__label" style="margin-top:0.75rem;">Allergener</p>
            <p class="option-card__desc price-list-row__desc"><?= nl2br(h($allergens), false) ?></p>
<?php endif; ?>
<?php if ($nutritionRows !== []): ?>
            <p class="inventory-facts__label" style="margin-top:0.75rem;">Näringsvärde per 100 g</p>
<?php renderFactList($nutritionRows); ?>
<?php endif; ?>
          </section>
<?php endif; ?>
          <section class="home-section home-section--rows price-list-section">
            <div class="home-section__head">
              <h2 class="home-section__title price-list-section__title"><?= $variants !== [] ? 'Lager' : 'Lager' ?></h2>
              <p class="inventory-stock-total">Totalt <span id="inventory-stock-total"><?= h((string) $stockTotal) ?></span> st</p>
            </div>
            <p id="inventory-stock-error" class="inventory-stock-error" hidden>Kunde inte spara lagersaldot.</p>
            <ul class="option-list price-list-rows">
<?php foreach ($stockRows as $variant): ?>
<?php
    $variantId = (int) ($variant['id'] ?? 0);
    $qty = (int) ($variant['quantity'] ?? 0);
    $sku = trim((string) ($variant['sku'] ?? ''));
    $gtin = trim((string) ($variant['gtin'] ?? ''));
    $variantMeta = [];
    if ($sku !== '') {
        $variantMeta[] = 'Art.nr ' . $sku;
    }
    if ($gtin !== '') {
        $variantMeta[] = 'GTIN ' . $gtin;
    }
    $rowTitle = $variants !== [] ? variantLabel($variant) : 'Lager';
?>
              <li
                class="option-card price-list-row"
                data-stock-row
                data-variant-id="<?= h((string) $variantId) ?>"
              >
                <div class="option-card__body">
                  <span class="option-card__title"><?= h($rowTitle) ?></span>
<?php if ($variantMeta !== []): ?>
                  <span class="option-card__desc price-list-row__desc"><?= h(implode(' · ', $variantMeta)) ?></span>
<?php endif; ?>
                </div>
                <span class="price-list-row__actions">
                  <button type="button" class="price-list-qty-btn price-list-qty-btn--minus" data-stock-delta="-1" aria-label="Minska antal"<?= $qty <= 0 ? ' disabled' : '' ?>>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
                      <path d="M5 12h14" />
                    </svg>
                  </button>
                  <span class="inventory-stock-qty" data-stock-qty><?= h((string) $qty) ?></span>
                  <button type="button" class="price-list-qty-btn price-list-qty-btn--plus" data-stock-delta="1" aria-label="Öka antal">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </button>
                </span>
              </li>
<?php endforeach; ?>
            </ul>
          </section>
        </div>
<?php endif; ?>
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
          <a class="bottom-bar__tab is-active" href="/inventory/" data-tab="inventory">
            <svg class="bottom-bar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <path d="M3.3 7 12 12l8.7-5M12 22V12" />
            </svg>
            <span class="bottom-bar__label">Inventory</span>
            <span class="bottom-bar__dot" aria-hidden="true"></span>
          </a>
        </div>
      </nav>
    </div>
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

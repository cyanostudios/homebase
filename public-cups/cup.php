<?php
declare(strict_types=1);

require_once __DIR__ . '/api/pdo_env.php';

function h(?string $value): string
{
    return htmlspecialchars((string) ($value ?? ''), ENT_QUOTES, 'UTF-8');
}

function siteBaseUrl(): string
{
    $raw = trim((string) (getenv('CUPS_PUBLIC_SITE_URL') ?: 'https://cupappen.se'));
    return rtrim($raw !== '' ? $raw : 'https://cupappen.se', '/');
}

/** Absolut bild-/resurslänk för OG/JSON-LD (hanterar /relativa vägar mot site base). */
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

/** Ta bort null ur JSON-LD-arrayer (läsbar för LLMs/sökmotorer). */
function jsonLdStripNulls(mixed $v): mixed
{
    if (is_array($v)) {
        $out = [];
        foreach ($v as $k => $item) {
            $clean = jsonLdStripNulls($item);
            if ($clean === null) {
                continue;
            }
            if (is_array($clean)) {
                if ($clean === []) {
                    continue;
                }
            }
            $out[$k] = $clean;
        }

        return $out;
    }

    return $v;
}

function normalizeText(?string $value): string
{
    return trim(html_entity_decode((string) ($value ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
}

function slugify(string $value): string
{
    $v = mb_strtolower(trim($value), 'UTF-8');
    $replacements = [
        'å' => 'a',
        'ä' => 'a',
        'ö' => 'o',
        'é' => 'e',
        'è' => 'e',
        'ü' => 'u',
    ];
    $v = strtr($v, $replacements);
    $v = preg_replace('/[^a-z0-9]+/u', '-', $v) ?? '';
    return trim($v, '-') ?: 'cup';
}

function cupYear(array $cup): ?int
{
    $raw = (string) ($cup['start_date'] ?? $cup['end_date'] ?? '');
    if ($raw === '') {
        return null;
    }
    $ts = strtotime($raw);
    if ($ts === false) {
        return null;
    }
    return (int) date('Y', $ts);
}

function cupPrettySlug(array $cup): string
{
    $base = slugify((string) ($cup['name'] ?? 'cup'));
    $year = cupYear($cup);
    return $year ? ($base . '-' . $year) : $base;
}

function parseCupPath(): ?array
{
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
    if (preg_match('#^/cup/(\d+)(?:-([a-z0-9-]+))?/?$#i', $path, $matches)) {
        return [
            'legacyId' => (int) $matches[1],
            'slug' => $matches[2] ?? '',
            'slugYear' => null,
        ];
    }
    if (preg_match('#^/cup/([a-z0-9-]+?)-(\d{4})/?$#i', $path, $matches)) {
        return [
            'legacyId' => null,
            'slug' => strtolower($matches[1]),
            'slugYear' => (int) $matches[2],
        ];
    }
    return null;
}

function formatDateSv(?string $value): string
{
    if (!$value) {
        return 'Datum saknas';
    }
    $ts = strtotime($value);
    if ($ts === false) {
        return $value;
    }
    return date('j M Y', $ts);
}

function dateRangeLabel(array $cup): string
{
    $start = $cup['start_date'] ?? null;
    $end = $cup['end_date'] ?? null;
    if (!$start && !$end) {
        return 'Datum saknas';
    }
    $startLabel = $start ? formatDateSv((string) $start) : '';
    $endLabel = $end ? formatDateSv((string) $end) : '';
    if ($startLabel !== '' && $endLabel !== '' && $startLabel !== $endLabel) {
        return $startLabel . ' - ' . $endLabel;
    }
    return $startLabel !== '' ? $startLabel : $endLabel;
}

function splitCategories(?string $categories): array
{
    if (!$categories) {
        return [];
    }
    $parts = array_map(static fn($s) => trim((string) $s), explode(',', $categories));
    return array_values(array_filter($parts, static fn($s) => $s !== ''));
}

function genericImageForCup(array $cup): string
{
    $images = [
        'https://images.pexels.com/photos/47730/the-ball-stadion-football-the-pitch-47730.jpeg?w=1600',
        'https://images.pexels.com/photos/274422/pexels-photo-274422.jpeg?w=1600',
        'https://images.pexels.com/photos/1171084/pexels-photo-1171084.jpeg?w=1600',
        'https://images.pexels.com/photos/186239/pexels-photo-186239.jpeg?w=1600',
        'https://images.pexels.com/photos/1308713/pexels-photo-1308713.jpeg?w=1600',
        'https://images.pexels.com/photos/3886384/pexels-photo-3886384.jpeg?w=1600',
    ];
    $idx = abs(crc32((string) ($cup['name'] ?? 'cup'))) % count($images);
    return $images[$idx];
}

function cupImageUrl(array $cup): string
{
    $raw = trim((string) ($cup['featured_image_url'] ?? ''));
    if ($raw !== '' && (str_starts_with($raw, 'http://') || str_starts_with($raw, 'https://') || str_starts_with($raw, '/'))) {
        return $raw;
    }
    return genericImageForCup($cup);
}

function starString(float $avg): string
{
    $filled = (int) round($avg);
    $out = '';
    for ($i = 1; $i <= 5; $i++) {
        $out .= $i <= $filled ? '★' : '☆';
    }
    return $out;
}

function fetchPublicCupsFallback(): array
{
    $envUrl = trim((string) (getenv('PUBLIC_CUPS_API_URL') ?: ''));
    $url = $envUrl !== '' ? $envUrl : 'http://localhost:3002/api/public/cups';
    $json = @file_get_contents($url);
    if ($json === false) {
        return [];
    }
    $payload = json_decode($json, true);
    if (!is_array($payload) || !isset($payload['cups']) || !is_array($payload['cups'])) {
        return [];
    }
    return array_values(
        array_filter(
            $payload['cups'],
            static fn($c) => is_array($c) && (($c['visible'] ?? true) !== false) && (($c['visible'] ?? 'true') !== 'false'),
        ),
    );
}

$pathParts = parseCupPath();
if ($pathParts === null) {
    http_response_code(404);
    include __DIR__ . '/index.html';
    exit;
}

try {
    $pdo = null;
    $allCupsFallback = [];
    $pdo = getPdoFromEnv();
    if ($pathParts['legacyId']) {
        $cupStmt = $pdo->prepare(
            "SELECT c.*, src.name AS ingest_source_name
             FROM cups c
             LEFT JOIN ingest_sources src ON src.id = c.ingest_source_id
             WHERE c.id = :id AND COALESCE(c.visible, TRUE) = TRUE
             LIMIT 1",
        );
        $cupStmt->execute(['id' => $pathParts['legacyId']]);
        $cup = $cupStmt->fetch();
    } else {
        $cupsStmt = $pdo->query(
            "SELECT c.*, src.name AS ingest_source_name
             FROM cups c
             LEFT JOIN ingest_sources src ON src.id = c.ingest_source_id
             WHERE COALESCE(c.visible, TRUE) = TRUE",
        );
        $cup = null;
        foreach ($cupsStmt->fetchAll() as $row) {
            if ((int) (cupYear($row) ?? 0) !== (int) $pathParts['slugYear']) {
                continue;
            }
            if (cupPrettySlug($row) === ($pathParts['slug'] . '-' . $pathParts['slugYear'])) {
                $cup = $row;
                break;
            }
        }
    }
} catch (Throwable $e) {
    $pdo = null;
    $allCupsFallback = fetchPublicCupsFallback();
    $cup = null;
    foreach ($allCupsFallback as $row) {
        if ($pathParts['legacyId']) {
            if ((int) ($row['id'] ?? 0) === (int) $pathParts['legacyId']) {
                $cup = $row;
                break;
            }
            continue;
        }
        if ((int) (cupYear($row) ?? 0) !== (int) $pathParts['slugYear']) {
            continue;
        }
        if (cupPrettySlug($row) === ($pathParts['slug'] . '-' . $pathParts['slugYear'])) {
            $cup = $row;
            break;
        }
    }
}

if (!$cup) {
    http_response_code(404);
    ?>
<!doctype html>
<html lang="sv">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex, follow" />
  <meta
    name="description"
    content="Den här cupen finns inte längre på Cupappen eller är inte publik. Utforska aktuella fotbollscuper på cupappen.se."
  />
  <title>Cup hittades inte - Cupappen</title>
  <link rel="stylesheet" href="/styles.css" />
  <link rel="stylesheet" href="/cupappen-cup-detail.css" />
</head>
<body>
  <main class="detail-not-found">
    <div>
      <h1>Cupen kunde inte hittas</h1>
      <p>Den här sidan finns inte längre eller är inte publik.</p>
      <a href="/">Tillbaka till Cupappen</a>
    </div>
  </main>
</body>
</html>
<?php
    exit;
}

$expectedPrettySlug = cupPrettySlug($cup);
if ($pathParts['legacyId'] || ($pathParts['slug'] . '-' . $pathParts['slugYear']) !== $expectedPrettySlug) {
    header('Location: /cup/' . $expectedPrettySlug, true, 301);
    exit;
}

$baseUrl = siteBaseUrl();
$canonicalPath = '/cup/' . $expectedPrettySlug;
$canonicalUrl = $baseUrl . $canonicalPath;
$title = normalizeText((string) ($cup['name'] ?? 'Cup'));
$dateRange = dateRangeLabel($cup);
$location = normalizeText((string) ($cup['location'] ?? ''));
$organizer = normalizeText((string) ($cup['organizer'] ?? ''));
$description = normalizeText((string) ($cup['description'] ?? ''));
$categories = splitCategories($cup['categories'] ?? null);
$imageUrl = cupImageUrl($cup);
$compareDateRaw = (string) ($cup['end_date'] ?? $cup['start_date'] ?? '');
$compareTs = $compareDateRaw !== '' ? strtotime($compareDateRaw) : false;
$isPastCup = $compareTs !== false && $compareTs < time();

$ratingsCount = 0;
$ratingsAvg = 0.0;
$distribution = ['1' => 0, '2' => 0, '3' => 0, '4' => 0, '5' => 0];
$ratings = [];
$related = [];

if ($pdo instanceof PDO) {
    $ratingsSummaryStmt = $pdo->prepare(
        "SELECT COUNT(*)::int AS count, ROUND(COALESCE(AVG(rating), 0)::numeric, 1) AS avg
         FROM cup_ratings WHERE cup_id = :cup_id",
    );
    $ratingsSummaryStmt->execute(['cup_id' => (int) $cup['id']]);
    $ratingsSummary = $ratingsSummaryStmt->fetch() ?: ['count' => 0, 'avg' => 0];
    $ratingsCount = (int) ($ratingsSummary['count'] ?? 0);
    $ratingsAvg = (float) ($ratingsSummary['avg'] ?? 0);

    $distStmt = $pdo->prepare("SELECT rating, COUNT(*)::int AS count FROM cup_ratings WHERE cup_id = :cup_id GROUP BY rating");
    $distStmt->execute(['cup_id' => (int) $cup['id']]);
    foreach ($distStmt->fetchAll() as $row) {
        $k = (string) ((int) ($row['rating'] ?? 0));
        if (isset($distribution[$k])) {
            $distribution[$k] = (int) ($row['count'] ?? 0);
        }
    }

    $ratingsStmt = $pdo->prepare(
        "SELECT reviewer_name, reviewer_role, reviewer_club, reviewer_class, rating, comment, created_at
         FROM cup_ratings
         WHERE cup_id = :cup_id
         ORDER BY created_at DESC
         LIMIT 30",
    );
    $ratingsStmt->execute(['cup_id' => (int) $cup['id']]);
    $ratings = $ratingsStmt->fetchAll();

    $relatedStmt = $pdo->prepare(
        "SELECT id, name, location, start_date, featured_image_url
         FROM cups
         WHERE id <> :id
           AND COALESCE(visible, TRUE) = TRUE
           AND (
             (organizer IS NOT NULL AND organizer <> '' AND organizer = :organizer)
             OR
             (location IS NOT NULL AND location <> '' AND location = :location)
           )
         ORDER BY start_date ASC NULLS LAST
         LIMIT 4",
    );
    $relatedStmt->execute([
        'id' => (int) $cup['id'],
        'organizer' => $cup['organizer'] ?? '',
        'location' => $cup['location'] ?? '',
    ]);
    $related = $relatedStmt->fetchAll();

    if (count($related) < 4) {
        $fallbackStmt = $pdo->prepare(
            "SELECT id, name, location, start_date, featured_image_url
             FROM cups
             WHERE id <> :id AND COALESCE(visible, TRUE) = TRUE
             ORDER BY start_date ASC NULLS LAST
             LIMIT 8",
        );
        $fallbackStmt->execute(['id' => (int) $cup['id']]);
        $seen = [];
        foreach ($related as $row) {
            $seen[(int) $row['id']] = true;
        }
        foreach ($fallbackStmt->fetchAll() as $row) {
            $id = (int) $row['id'];
            if (isset($seen[$id])) {
                continue;
            }
            $related[] = $row;
            $seen[$id] = true;
            if (count($related) >= 4) {
                break;
            }
        }
    }
} else {
    if (!isset($allCupsFallback) || !is_array($allCupsFallback)) {
        $allCupsFallback = fetchPublicCupsFallback();
    }
    $relatedPool = array_values(
        array_filter(
            $allCupsFallback,
            static fn($row) => (int) ($row['id'] ?? 0) !== (int) ($cup['id'] ?? 0),
        ),
    );
    $related = array_slice($relatedPool, 0, 4);
}

$metaDescription = $description !== '' ? $description : trim($title . ' i ' . ($location !== '' ? $location : 'Sverige') . '. Datum, arrangör och anmälan på Cupappen.');
$metaDescriptionHtml = truncateMetaDescription($metaDescription !== '' ? $metaDescription : $title);
$ogImageUrl = absolutePublicUrl($baseUrl, $imageUrl);

$registrationRaw = trim((string) ($cup['registration_url'] ?? ''));
$registrationAbs = $registrationRaw !== '' ? absolutePublicUrl($baseUrl, $registrationRaw) : '';

$keywordsParts = $categories;
$matchFormatKw = normalizeText((string) ($cup['match_format'] ?? ''));
if ($matchFormatKw !== '') {
    $keywordsParts[] = $matchFormatKw;
}
$districtKw = normalizeText((string) ($cup['ingest_source_name'] ?? ''));
if ($districtKw !== '') {
    $keywordsParts[] = $districtKw;
}
$keywordsCsv = implode(', ', array_unique(array_values(array_filter($keywordsParts))));

$sportsEventLd = [
    '@type' => 'SportsEvent',
    '@id' => $canonicalUrl . '#cup',
    'identifier' => ((int) ($cup['id'] ?? 0)) > 0 ? (string) ((int) $cup['id']) : null,
    'name' => $title,
    'url' => $canonicalUrl,
    'inLanguage' => 'sv-SE',
    'startDate' => $cup['start_date'] ?: null,
    'endDate' => $cup['end_date'] ?: null,
    'sport' => 'Fotboll',
    'description' => $metaDescriptionHtml !== '' ? $metaDescriptionHtml : $metaDescription,
    'eventAttendanceMode' => 'https://schema.org/OfflineEventAttendanceMode',
    'eventStatus' => 'https://schema.org/EventScheduled',
];
if ($keywordsCsv !== '') {
    $sportsEventLd['keywords'] = $keywordsCsv;
}
$sportsEventLd['image'] = [$ogImageUrl];
if ($location !== '') {
    $sportsEventLd['location'] = ['@type' => 'Place', 'name' => $location];
}
if ($organizer !== '') {
    $sportsEventLd['organizer'] = ['@type' => 'Organization', 'name' => $organizer];
}
if ($registrationAbs !== '' && (str_starts_with($registrationAbs, 'http://') || str_starts_with($registrationAbs, 'https://'))) {
    $sportsEventLd['offers'] = [
        '@type' => 'Offer',
        'url' => $registrationAbs,
        'availability' => 'https://schema.org/InStock',
        'price' => '0',
        'priceCurrency' => 'SEK',
    ];
}
if (!empty($cup['team_count'])) {
    $tc = (int) $cup['team_count'];
    if ($tc > 0) {
        $sportsEventLd['maximumAttendeeCapacity'] = $tc;
    }
}
if ($ratingsCount > 0) {
    $sportsEventLd['aggregateRating'] = [
        '@type' => 'AggregateRating',
        'ratingValue' => round($ratingsAvg, 1),
        'bestRating' => 5,
        'worstRating' => 1,
        'ratingCount' => $ratingsCount,
    ];
}
$sportsEventLd['mainEntityOfPage'] = ['@id' => $canonicalUrl . '#webpage'];

$organizationLd = [
    '@type' => 'Organization',
    '@id' => $baseUrl . '/#organization',
    'name' => 'Cupappen',
    'url' => $baseUrl . '/',
    'email' => 'info@cupappen.se',
    'logo' => [
        '@type' => 'ImageObject',
        'url' => absolutePublicUrl($baseUrl, '/assets/cupappen-logo.png'),
        'width' => 1536,
        'height' => 1024,
    ],
];

$websiteLd = [
    '@type' => 'WebSite',
    '@id' => $baseUrl . '/#website',
    'name' => 'Cupappen',
    'url' => $baseUrl . '/',
    'inLanguage' => 'sv-SE',
    'publisher' => ['@id' => $organizationLd['@id']],
];

$breadcrumbLd = [
    '@type' => 'BreadcrumbList',
    '@id' => $canonicalUrl . '#breadcrumb',
    'itemListElement' => [
        [
            '@type' => 'ListItem',
            'position' => 1,
            'name' => 'Cupappen',
            'item' => $baseUrl . '/',
        ],
        [
            '@type' => 'ListItem',
            'position' => 2,
            'name' => $title,
            'item' => $canonicalUrl,
        ],
    ],
];

$webPageLd = [
    '@type' => 'WebPage',
    '@id' => $canonicalUrl . '#webpage',
    'url' => $canonicalUrl,
    'name' => $title . ' | Cupappen',
    'description' => $metaDescriptionHtml !== '' ? $metaDescriptionHtml : $metaDescription,
    'inLanguage' => 'sv-SE',
    'primaryImageOfPage' => ['@type' => 'ImageObject', 'url' => $ogImageUrl],
    'publisher' => ['@id' => $organizationLd['@id']],
    'isPartOf' => ['@id' => $websiteLd['@id']],
    'about' => ['@id' => $canonicalUrl . '#cup'],
    'mainEntity' => ['@id' => $canonicalUrl . '#cup'],
    'breadcrumb' => ['@id' => $canonicalUrl . '#breadcrumb'],
];

$jsonLdGraph = jsonLdStripNulls([
    '@context' => 'https://schema.org',
    '@graph' => [$organizationLd, $websiteLd, $webPageLd, $breadcrumbLd, $sportsEventLd],
]);

?>
<!doctype html>
<html lang="sv">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title><?= h($title) ?> · Cupappen</title>
  <meta name="description" content="<?= h($metaDescriptionHtml !== '' ? $metaDescriptionHtml : $metaDescription) ?>" />
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
  <meta name="googlebot" content="index, follow, max-image-preview:large, max-snippet:-1" />
  <meta name="theme-color" content="#099ea2" />
  <meta name="author" content="Cupappen" />
  <meta name="application-name" content="Cupappen" />
  <?php if ($keywordsCsv !== ''): ?>
    <meta name="keywords" content="<?= h($keywordsCsv) ?>" />
  <?php endif; ?>
  <link rel="canonical" href="<?= h($canonicalUrl) ?>" />
  <link rel="alternate" hreflang="sv-SE" href="<?= h($canonicalUrl) ?>" />
  <link rel="alternate" hreflang="x-default" href="<?= h($canonicalUrl) ?>" />
  <meta property="og:locale" content="sv_SE" />
  <meta property="og:site_name" content="Cupappen" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="<?= h($title) ?> · Cupappen" />
  <meta property="og:description" content="<?= h($metaDescriptionHtml !== '' ? $metaDescriptionHtml : $metaDescription) ?>" />
  <meta property="og:url" content="<?= h($canonicalUrl) ?>" />
  <meta property="og:image" content="<?= h($ogImageUrl) ?>" />
  <?php if (str_starts_with($ogImageUrl, 'https://')): ?>
    <meta property="og:image:secure_url" content="<?= h($ogImageUrl) ?>" />
  <?php endif; ?>
  <meta property="og:image:alt" content="<?= h($title) ?>" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="<?= h($title) ?> · Cupappen" />
  <meta name="twitter:description" content="<?= h($metaDescriptionHtml !== '' ? $metaDescriptionHtml : $metaDescription) ?>" />
  <meta name="twitter:image" content="<?= h($ogImageUrl) ?>" />
  <meta name="twitter:image:alt" content="<?= h($title) ?>" />
  <link rel="icon" type="image/svg+xml" href="<?= h($baseUrl . '/favicon.svg') ?>" />
  <link rel="icon" type="image/png" sizes="48x48" href="<?= h($baseUrl . '/assets/cupappen-favicon.png') ?>" />
  <link rel="sitemap" type="application/xml" title="Cupappen sitemap" href="<?= h($baseUrl . '/sitemap.xml') ?>" />
  <link rel="alternate" type="text/plain" title="LLM / AI site guide (llms.txt)" href="<?= h($baseUrl . '/llms.txt') ?>" />
  <link rel="stylesheet" href="/styles.css" />
  <link rel="stylesheet" href="/cupappen-cup-detail.css" />
  <script type="application/ld+json"><?= h(json_encode($jsonLdGraph, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)) ?></script>
</head>
<body>
  <header class="detail-header">
    <div class="container detail-header__inner">
      <a href="/" class="logo" aria-label="Cupappen startsida">
        <picture>
          <source srcset="/assets/cupappen-logo.webp" type="image/webp" />
          <img
            class="logo__img"
            src="/assets/cupappen-logo.png"
            alt="Cupappen"
            width="360"
            height="240"
            decoding="async"
          />
        </picture>
      </a>
      <a class="detail-back" href="/">Tillbaka</a>
    </div>
  </header>

  <section class="cover">
    <div class="cover__media">
      <img src="<?= h($imageUrl) ?>" alt="<?= h($title) ?>" />
      <div class="cover__gradient"></div>
      <div class="cover__content">
        <span class="cover__chip"><span class="dot"></span>Cupdetaljer</span>
        <h1 class="cover__title"><?= h($title) ?></h1>
        <div class="cover__meta">
          <?php if ($location !== ''): ?><span class="cover__meta-item"><?= h($location) ?></span><?php endif; ?>
          <span class="cover__meta-item"><?= h($dateRange) ?></span>
          <?php if (!empty($cup['team_count'])): ?><span class="cover__meta-item"><?= h((string) ((int) $cup['team_count'])) ?> lag</span><?php endif; ?>
        </div>
      </div>
    </div>
  </section>

  <main class="container detail-layout">
    <div class="detail-layout__main">
      <div class="summary-row">
        <span class="summary-chip"><?= h(starString($ratingsAvg)) ?> <strong><?= h(number_format($ratingsAvg, 1)) ?></strong> <span class="summary-chip__count">(<?= h((string) $ratingsCount) ?>)</span></span>
        <button class="share-btn" id="share-btn" type="button">Dela</button>
      </div>

      <div class="highlights-grid">
        <?php if (($cup['sanctioned'] ?? true) !== false && ($cup['sanctioned'] ?? 'true') !== 'false'): ?>
          <div class="highlight-item"><span class="highlight-item__check">✓</span><div class="highlight-item__text">Sanktionerad cup</div></div>
        <?php endif; ?>
        <?php if (!empty($cup['match_format'])): ?>
          <div class="highlight-item"><span class="highlight-item__check">✓</span><div class="highlight-item__text">Spelform: <?= h((string) $cup['match_format']) ?></div></div>
        <?php endif; ?>
        <?php if ($organizer !== ''): ?>
          <div class="highlight-item"><span class="highlight-item__check">✓</span><div class="highlight-item__text">Arrangör: <?= h($organizer) ?></div></div>
        <?php endif; ?>
      </div>

      <?php if (count($categories) > 0): ?>
        <div class="included-chips">
          <?php foreach ($categories as $category): ?>
            <span class="included-chip"><?= h($category) ?></span>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>

      <?php if ($description !== ''): ?>
        <section style="margin-top: 2rem;">
          <h2 class="h3">Om cupen</h2>
          <p><?= h($description) ?></p>
        </section>
      <?php endif; ?>

      <section class="ratings-block" id="ratings">
        <h2 class="h3">Betyg och omdömen</h2>
        <div class="ratings-summary">
          <div class="ratings-summary__avg">
            <div class="ratings-summary__avg-num"><?= h(number_format($ratingsAvg, 1)) ?></div>
            <div><?= h(starString($ratingsAvg)) ?></div>
            <div class="ratings-summary__count"><?= h((string) $ratingsCount) ?> omdömen</div>
          </div>
          <div class="ratings-bars">
            <?php for ($star = 5; $star >= 1; $star--):
                $count = $distribution[(string) $star];
                $width = $ratingsCount > 0 ? ($count / $ratingsCount) * 100 : 0;
                ?>
              <div class="rating-bar-row">
                <span class="rating-bar-row__label"><?= h((string) $star) ?></span>
                <div class="rating-bar-row__track"><div class="rating-bar-row__fill" style="width: <?= h(number_format($width, 2, '.', '')) ?>%"></div></div>
                <span class="rating-bar-row__count"><?= h((string) $count) ?></span>
              </div>
            <?php endfor; ?>
          </div>
        </div>

        <?php if (count($ratings) === 0): ?>
          <div class="ratings-list ratings-list--empty">Inga omdömen än. Bli först med att lämna ett betyg.</div>
        <?php else: ?>
          <div class="ratings-list">
            <?php foreach ($ratings as $rating):
                $name = normalizeText((string) ($rating['reviewer_name'] ?? 'Anonym'));
                $initial = mb_substr($name, 0, 1, 'UTF-8');
                ?>
              <article class="rating-item">
                <div class="rating-item__row">
                  <div class="rating-avatar"><?= h(mb_strtoupper($initial, 'UTF-8')) ?></div>
                  <div>
                    <div class="rating-item__head">
                      <span class="rating-item__name"><?= h($name) ?></span>
                      <?php if (!empty($rating['reviewer_role'])): ?><span class="rating-item__role"><?= h((string) $rating['reviewer_role']) ?></span><?php endif; ?>
                      <?php if (!empty($rating['reviewer_club'])): ?><span class="rating-item__role"><?= h((string) $rating['reviewer_club']) ?></span><?php endif; ?>
                      <?php if (!empty($rating['reviewer_class'])): ?><span class="rating-item__role"><?= h((string) $rating['reviewer_class']) ?></span><?php endif; ?>
                      <?php if (!empty($rating['created_at'])): ?><span class="rating-item__date"><?= h(date('Y-m-d', strtotime((string) $rating['created_at']))) ?></span><?php endif; ?>
                    </div>
                    <div class="rating-item__stars"><?= h(str_repeat('★', (int) $rating['rating']) . str_repeat('☆', max(0, 5 - (int) $rating['rating']))) ?></div>
                    <?php if (!empty($rating['comment'])): ?><p class="rating-item__comment"><?= h((string) $rating['comment']) ?></p><?php endif; ?>
                  </div>
                </div>
              </article>
            <?php endforeach; ?>
          </div>
        <?php endif; ?>

        <form class="rating-form" id="rating-form">
          <h3 class="rating-form__title">Lämna omdöme</h3>
          <p class="rating-form__lead">Ditt omdöme hjälper andra lag att välja rätt cup.</p>
          <div class="form-stack">
            <div class="form-field">
              <label class="form-field__label">Betyg</label>
              <div class="star-picker" id="star-picker"></div>
              <input type="hidden" name="rating" id="rating-value" value="0" />
            </div>
            <div class="form-row">
              <div class="form-field">
                <label class="form-field__label" for="reviewer_name">Namn</label>
                <input class="form-input" id="reviewer_name" name="reviewer_name" required />
              </div>
              <div class="form-field">
                <label class="form-field__label" for="reviewer_role">Roll</label>
                <input class="form-input" id="reviewer_role" name="reviewer_role" placeholder="Tränare / Förälder / Spelare" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-field">
                <label class="form-field__label" for="reviewer_club">Förening / Klubb</label>
                <input class="form-input" id="reviewer_club" name="reviewer_club" placeholder="Ex. IFK Göteborg" />
              </div>
              <div class="form-field">
                <label class="form-field__label" for="reviewer_class">Klass</label>
                <input class="form-input" id="reviewer_class" name="reviewer_class" placeholder="Ex. F16, P12" maxlength="40" />
              </div>
            </div>
            <div class="form-field">
              <label class="form-field__label" for="comment">Kommentar</label>
              <textarea class="form-textarea" id="comment" name="comment" rows="4"></textarea>
            </div>
            <button class="info-card__cta" type="submit">Skicka omdöme</button>
            <p class="form-error" id="rating-error" hidden></p>
            <p class="form-success" id="rating-success" hidden>Tack! Omdömet är sparat.</p>
          </div>
        </form>
      </section>
    </div>

    <aside class="sidebar">
      <section class="info-card">
        <span class="info-card__label">Cupinfo</span>
        <div class="info-card__price"><?= h(number_format($ratingsAvg, 1)) ?>/5</div>
        <?php if ($isPastCup): ?>
          <p class="info-card__alert-expired">Cupdatumet har passerat</p>
        <?php endif; ?>
        <ul class="info-list">
          <li class="info-list__row"><div><span class="info-list__label">Datum</span><p class="info-list__value"><?= h($dateRange) ?></p></div></li>
          <?php if ($location !== ''): ?><li class="info-list__row"><div><span class="info-list__label">Plats</span><p class="info-list__value"><?= h($location) ?></p></div></li><?php endif; ?>
          <?php if ($organizer !== ''): ?><li class="info-list__row"><div><span class="info-list__label">Arrangör</span><p class="info-list__value"><?= h($organizer) ?></p></div></li><?php endif; ?>
          <?php if (!empty($cup['team_count'])): ?><li class="info-list__row"><div><span class="info-list__label">Lag</span><p class="info-list__value"><?= h((string) ((int) $cup['team_count'])) ?></p></div></li><?php endif; ?>
        </ul>
        <?php if (!empty($cup['registration_url'])): ?>
          <a class="info-card__cta" target="_blank" rel="noopener noreferrer" href="<?= h((string) $cup['registration_url']) ?>">Till anmälan</a>
        <?php endif; ?>
      </section>

      <section class="related-card">
        <h3 class="related-card__title">Liknande cuper</h3>
        <ul class="related-list">
          <?php foreach ($related as $rel):
              $relName = normalizeText((string) ($rel['name'] ?? 'Cup'));
              $relHref = '/cup/' . cupPrettySlug($rel);
              $relImage = cupImageUrl($rel);
              ?>
            <li>
              <a class="related-link" href="<?= h($relHref) ?>">
                <img src="<?= h($relImage) ?>" alt="<?= h($relName) ?>" />
                <div class="related-link__body">
                  <div class="related-link__name"><?= h($relName) ?></div>
                  <div class="related-link__meta"><?= h(normalizeText((string) ($rel['location'] ?? ''))) ?> · <?= h(dateRangeLabel($rel)) ?></div>
                </div>
              </a>
            </li>
          <?php endforeach; ?>
        </ul>
      </section>
    </aside>
  </main>

  <footer class="detail-footer">
    <a href="/">Tillbaka till Cupappen</a>
  </footer>

  <script>
    (function () {
      const cupId = <?= (int) $cup['id'] ?>;
      const form = document.getElementById('rating-form');
      const errorEl = document.getElementById('rating-error');
      const successEl = document.getElementById('rating-success');
      const picker = document.getElementById('star-picker');
      const ratingValue = document.getElementById('rating-value');
      const shareBtn = document.getElementById('share-btn');
      let currentRating = 0;

      function renderStars() {
        if (!picker) return;
        picker.innerHTML = '';
        for (let i = 1; i <= 5; i++) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.dataset.active = i <= currentRating ? 'true' : 'false';
          btn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="m12 17.3-6.18 3.73 1.64-7.03L2 9.27l7.19-.62L12 2l2.81 6.65 7.19.62-5.46 4.73 1.64 7.03z"/></svg>';
          btn.addEventListener('click', function () {
            currentRating = i;
            if (ratingValue) ratingValue.value = String(i);
            renderStars();
          });
          picker.appendChild(btn);
        }
      }
      renderStars();

      if (shareBtn) {
        shareBtn.addEventListener('click', async function () {
          try {
            if (navigator.share) {
              await navigator.share({ url: window.location.href });
            } else {
              await navigator.clipboard.writeText(window.location.href);
              shareBtn.textContent = 'Länk kopierad';
              setTimeout(() => (shareBtn.textContent = 'Dela'), 1500);
            }
          } catch (_) {}
        });
      }

      if (!form) return;
      form.addEventListener('submit', async function (event) {
        event.preventDefault();
        if (errorEl) {
          errorEl.hidden = true;
          errorEl.textContent = '';
        }
        if (successEl) successEl.hidden = true;

        const body = {
          cup_id: cupId,
          reviewer_name: String(document.getElementById('reviewer_name')?.value || '').trim(),
          reviewer_role: String(document.getElementById('reviewer_role')?.value || '').trim(),
          reviewer_club: String(document.getElementById('reviewer_club')?.value || '').trim(),
          reviewer_class: String(document.getElementById('reviewer_class')?.value || '').trim(),
          comment: String(document.getElementById('comment')?.value || '').trim(),
          rating: Number(ratingValue?.value || 0),
        };

        if (!body.reviewer_name || body.rating < 1 || body.rating > 5) {
          if (errorEl) {
            errorEl.hidden = false;
            errorEl.textContent = 'Namn och betyg (1-5) krävs.';
          }
          return;
        }

        try {
          const response = await fetch('/api/ratings.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          const payload = await response.json();
          if (!response.ok) {
            throw new Error(payload?.error || 'Kunde inte spara omdömet.');
          }
          if (successEl) successEl.hidden = false;
          setTimeout(() => window.location.reload(), 500);
        } catch (err) {
          if (errorEl) {
            errorEl.hidden = false;
            errorEl.textContent = err?.message || 'Kunde inte spara omdömet.';
          }
        }
      });
    })();
  </script>
</body>
</html>

<?php

declare(strict_types=1);

require_once __DIR__ . '/pdo_env.php';
require_once __DIR__ . '/db_helpers.php';
require_once __DIR__ . '/security_headers.php';

applyPublicCupsSecurityHeaders('xml');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'GET' && $method !== 'HEAD') {
    http_response_code(405);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Method not allowed';
    exit;
}
$isHead = $method === 'HEAD';
if ($isHead) {
    ob_start();
}

function finishSitemapResponse(bool $isHead): void
{
    if (!$isHead) {
        return;
    }
    $len = ob_get_length();
    ob_end_clean();
    if ($len !== false && $len > 0) {
        header('Content-Length: ' . (string) $len);
    }
    exit;
}

/**
 * Publik bas-URL (utan avslutande snedstreck), t.ex. https://www.cupappen.se
 */
function publicSiteBaseUrl(): string
{
    $raw = getenv('CUPS_PUBLIC_SITE_URL') ?: '';
    $raw = trim($raw, " \t\n\r\0\x0B/");
    if ($raw !== '' && (str_starts_with($raw, 'https://') || str_starts_with($raw, 'http://'))) {
        return $raw;
    }

    return 'https://www.cupappen.se';
}

/**
 * Säker sträng i XML.
 */
function xmlText(string $s): string
{
    return htmlspecialchars($s, ENT_XML1 | ENT_QUOTES, 'UTF-8');
}

/**
 * W3C lastmod (datum räcker för sitemap 0.9).
 */
function lastModFromValue(?string $value): string
{
    if ($value === null || $value === '') {
        return gmdate('Y-m-d');
    }
    $ts = strtotime($value);
    if ($ts === false) {
        return gmdate('Y-m-d');
    }

    return gmdate('Y-m-d', $ts);
}

function slugify(string $value): string
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
    return trim($v, '-') ?: 'cup';
}

function cupYear(array $row): ?int
{
    $raw = (string) ($row['start_date'] ?? $row['end_date'] ?? '');
    if ($raw === '') {
        return null;
    }
    $ts = strtotime($raw);
    if ($ts === false) {
        return null;
    }
    return (int) date('Y', $ts);
}

header('Content-Type: application/xml; charset=utf-8');

$base = publicSiteBaseUrl();

try {
    $pdo = getPdoFromEnv();
    $stmt = $pdo->query(publicCupsSitemapSql($pdo));
    $rows = $stmt->fetchAll();

    $maxTs = 0;
    foreach ($rows as $row) {
        if (!empty($row['updated_at'])) {
            $t = strtotime((string) $row['updated_at']);
            if ($t !== false) {
                $maxTs = max($maxTs, $t);
            }
        }
    }
    if ($maxTs === 0) {
        $maxTs = time();
    }
    $homeLastmod = gmdate('Y-m-d', $maxTs);
} catch (Throwable $e) {
    $base = publicSiteBaseUrl();
    $homeLastmod = gmdate('Y-m-d');
    echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
    echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
    echo '  <url>' . "\n";
    echo '    <loc>' . xmlText($base . '/') . '</loc>' . "\n";
    echo '    <lastmod>' . xmlText($homeLastmod) . '</lastmod>' . "\n";
    echo '    <changefreq>daily</changefreq>' . "\n";
    echo '    <priority>1.0</priority>' . "\n";
    echo '  </url>' . "\n";
    echo '</urlset>';
    finishSitemapResponse($isHead);
    exit;
}

echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
echo '  <url>' . "\n";
echo '    <loc>' . xmlText($base . '/') . '</loc>' . "\n";
echo '    <lastmod>' . xmlText($homeLastmod) . '</lastmod>' . "\n";
echo '    <changefreq>daily</changefreq>' . "\n";
echo '    <priority>1.0</priority>' . "\n";
echo '  </url>' . "\n";

$staticListingPaths = [
    '/sok/' => '0.9',
    '/kommande/' => '0.7',
    '/info/' => '0.6',
];
foreach ($staticListingPaths as $path => $priority) {
    echo '  <url>' . "\n";
    echo '    <loc>' . xmlText($base . $path) . '</loc>' . "\n";
    echo '    <lastmod>' . xmlText($homeLastmod) . '</lastmod>' . "\n";
    echo '    <changefreq>daily</changefreq>' . "\n";
    echo '    <priority>' . xmlText($priority) . '</priority>' . "\n";
    echo '  </url>' . "\n";
}

$districtSlugs = [];
$hasOvrigt = false;
foreach ($rows as $row) {
    $district = trim((string) ($row['ingest_source_name'] ?? ''));
    if ($district === '') {
        $hasOvrigt = true;
        continue;
    }
    $slug = slugify($district);
    if ($slug === '' || $slug === 'cup') {
        continue;
    }
    $districtSlugs[$slug] = true;
}
if ($hasOvrigt) {
    $districtSlugs['ovrigt'] = true;
}
ksort($districtSlugs, SORT_STRING);
foreach (array_keys($districtSlugs) as $districtSlug) {
    echo '  <url>' . "\n";
    echo '    <loc>' . xmlText($base . '/' . $districtSlug . '/') . '</loc>' . "\n";
    echo '    <lastmod>' . xmlText($homeLastmod) . '</lastmod>' . "\n";
    echo '    <changefreq>daily</changefreq>' . "\n";
    echo '    <priority>0.8</priority>' . "\n";
    echo '  </url>' . "\n";
}

foreach ($rows as $row) {
    $id = (int) ($row['id'] ?? 0);
    if ($id < 1) {
        continue;
    }
    $lastmod = lastModFromValue($row['updated_at'] ?? null);
    $cupSlug = slugify((string) ($row['name'] ?? 'cup'));
    $year = cupYear($row);
    $pretty = $cupSlug . ($year ? ('-' . (string) $year) : '');
    $districtName = trim((string) ($row['ingest_source_name'] ?? ''));
    $districtSlug = $districtName !== '' ? slugify($districtName) : 'ovrigt';
    $loc = $base . '/' . $districtSlug . '/' . $pretty;
    echo '  <url>' . "\n";
    echo '    <loc>' . xmlText($loc) . '</loc>' . "\n";
    echo '    <lastmod>' . xmlText($lastmod) . '</lastmod>' . "\n";
    echo '    <changefreq>weekly</changefreq>' . "\n";
    echo '    <priority>0.7</priority>' . "\n";
    echo '  </url>' . "\n";
}
echo '</urlset>';
finishSitemapResponse($isHead);

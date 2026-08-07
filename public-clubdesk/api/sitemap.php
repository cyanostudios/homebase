<?php

declare(strict_types=1);

require_once __DIR__ . '/pdo_env.php';
require_once __DIR__ . '/db_helpers.php';
require_once __DIR__ . '/security_headers.php';

applyPublicAppSecurityHeaders('xml');

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

function publicSiteBaseUrl(): string
{
    $raw = getenv('APP_PUBLIC_URL') ?: '';
    $raw = trim($raw, " \t\n\r\0\x0B/");
    if ($raw !== '' && (str_starts_with($raw, 'https://') || str_starts_with($raw, 'http://'))) {
        return $raw;
    }

    return 'https://www.example.se';
}

function xmlText(string $s): string
{
    return htmlspecialchars($s, ENT_XML1 | ENT_QUOTES, 'UTF-8');
}

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

    return trim($v, '-') ?: 'item';
}

header('Content-Type: application/xml; charset=utf-8');

$base = publicSiteBaseUrl();

try {
    $pdo = getPdoFromEnv();
    $stmt = $pdo->query(publicAppSitemapSql($pdo));
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

foreach (['/guides/', '/price-lists/', '/info/'] as $listingPath) {
    echo '  <url>' . "\n";
    echo '    <loc>' . xmlText($base . $listingPath) . '</loc>' . "\n";
    echo '    <lastmod>' . xmlText($homeLastmod) . '</lastmod>' . "\n";
    echo '    <changefreq>weekly</changefreq>' . "\n";
    echo '    <priority>0.8</priority>' . "\n";
    echo '  </url>' . "\n";
}

$categorySlugs = [];
foreach ($rows as $row) {
    $id = (int) ($row['id'] ?? 0);
    if ($id < 1) {
        continue;
    }
    $lastmod = lastModFromValue($row['updated_at'] ?? null);
    $slug = trim((string) ($row['slug'] ?? ''));
    if ($slug === '') {
        $slug = slugify((string) ($row['name'] ?? 'item'));
    }
    $kind = (string) ($row['kind'] ?? 'guide');
    if ($kind === 'price-list') {
        $loc = $base . '/price-list/' . $slug;
    } else {
        $catRaw = trim((string) ($row['category'] ?? ''));
        if ($catRaw !== '') {
            $first = trim(explode(',', $catRaw, 2)[0]);
            if ($first !== '') {
                $categorySlugs[slugify($first)] = true;
            }
        }
        $loc = $base . '/guide/' . $slug;
    }
    echo '  <url>' . "\n";
    echo '    <loc>' . xmlText($loc) . '</loc>' . "\n";
    echo '    <lastmod>' . xmlText($lastmod) . '</lastmod>' . "\n";
    echo '    <changefreq>weekly</changefreq>' . "\n";
    echo '    <priority>0.7</priority>' . "\n";
    echo '  </url>' . "\n";
}

foreach (array_keys($categorySlugs) as $catSlug) {
    echo '  <url>' . "\n";
    echo '    <loc>' . xmlText($base . '/kategori/' . $catSlug . '/') . '</loc>' . "\n";
    echo '    <lastmod>' . xmlText($homeLastmod) . '</lastmod>' . "\n";
    echo '    <changefreq>weekly</changefreq>' . "\n";
    echo '    <priority>0.6</priority>' . "\n";
    echo '  </url>' . "\n";
}
echo '</urlset>';
finishSitemapResponse($isHead);

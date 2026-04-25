<?php

declare(strict_types=1);

require_once __DIR__ . '/pdo_env.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Method not allowed';
    exit;
}

/**
 * Publik bas-URL (utan avslutande snedstreck), t.ex. https://cupappen.se
 */
function publicSiteBaseUrl(): string
{
    $raw = getenv('CUPS_PUBLIC_SITE_URL') ?: '';
    $raw = trim($raw, " \t\n\r\0\x0B/");
    if ($raw !== '' && (str_starts_with($raw, 'https://') || str_starts_with($raw, 'http://'))) {
        return $raw;
    }

    return 'https://cupappen.se';
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

header('Content-Type: application/xml; charset=utf-8');

$base = publicSiteBaseUrl();

try {
    $pdo = getPdoFromEnv();
    $sql = <<<'SQL'
SELECT c.id, c.updated_at
FROM cups c
WHERE COALESCE(c.visible, TRUE) = TRUE
ORDER BY c.start_date ASC NULLS LAST, c.name ASC, c.id ASC
SQL;
    $stmt = $pdo->query($sql);
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

foreach ($rows as $row) {
    $id = (int) ($row['id'] ?? 0);
    if ($id < 1) {
        continue;
    }
    $lastmod = lastModFromValue($row['updated_at'] ?? null);
    $loc = $base . '/#cup-' . (string) $id;
    echo '  <url>' . "\n";
    echo '    <loc>' . xmlText($loc) . '</loc>' . "\n";
    echo '    <lastmod>' . xmlText($lastmod) . '</lastmod>' . "\n";
    echo '    <changefreq>weekly</changefreq>' . "\n";
    echo '    <priority>0.7</priority>' . "\n";
    echo '  </url>' . "\n";
}
echo '</urlset>';

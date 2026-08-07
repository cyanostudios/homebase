<?php

declare(strict_types=1);

require_once __DIR__ . '/pdo_env.php';
require_once __DIR__ . '/db_helpers.php';
require_once __DIR__ . '/security_headers.php';
require_once __DIR__ . '/cors.php';

/**
 * Public Clubdesk site content (home + info HTML cards).
 */

applyPublicAppSecurityHeaders('json');
header('Content-Type: application/json; charset=utf-8');

function respond(int $statusCode, array $payload): void
{
    http_response_code($statusCode);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

applyCors();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    respond(405, ['error' => 'Method not allowed']);
}

function publicClubdeskSanitizeHtml(string $html): string
{
    if ($html === '') {
        return '';
    }

    $out = preg_replace('/<\/?(?:script|style|iframe|object|embed|form|link|meta|svg|math)\b[^>]*>/i', '', $html) ?? '';
    $out = preg_replace('/\s+on[a-z]+\s*=\s*("[^"]*"|\'[^\']*\'|[^\s>]+)/i', '', $out) ?? '';
    $out = preg_replace('/\s+style\s*=\s*("[^"]*"|\'[^\']*\'|[^\s>]+)/i', '', $out) ?? '';
    $out = preg_replace(
        '/\s+(href|src)\s*=\s*(["\'])\s*(javascript:|data:)/i',
        ' $1=$2#blocked-',
        $out,
    ) ?? '';
    $out = preg_replace(
        '/<\/?(?!\/?(?:p|br|strong|b|em|i|u|ul|ol|li|a|h[1-3]|blockquote|span|div)\b)[a-z0-9-]+\b[^>]*>/i',
        '',
        $out,
    ) ?? '';

    $out = preg_replace_callback(
        '/<a\b([^>]*)>/i',
        static function (array $m): string {
            $attrs = $m[1] ?? '';
            if (!preg_match('/\bhref\s*=\s*(["\'])(.*?)\1/i', $attrs, $hrefMatch)) {
                return '<a>';
            }
            $href = trim((string) $hrefMatch[2]);
            if (preg_match('/^(https?:\/\/|mailto:|\/|#)/i', $href) !== 1) {
                return '<a>';
            }
            return '<a href="' . htmlspecialchars($href, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '" rel="noopener noreferrer">';
        },
        $out,
    ) ?? $out;

    return trim($out);
}

function publicClubdeskIsBlankHtml(string $html): bool
{
    $plain = preg_replace('/<[^>]*>/', ' ', $html) ?? '';
    $plain = str_ireplace('&nbsp;', ' ', $plain);
    return trim($plain) === '';
}

try {
    $cacheTtl = (int) (getenv('APP_CACHE_TTL') ?: 0);
    $cacheEnabled = $cacheTtl > 0 && function_exists('apcu_fetch') && filter_var(ini_get('apc.enabled'), FILTER_VALIDATE_BOOLEAN);
    $cacheKey = 'public_clubdesk_site_content_v1';

    if ($cacheEnabled) {
        $cached = apcu_fetch($cacheKey, $ok);
        if ($ok && is_array($cached)) {
            respond(200, $cached);
        }
    }

    if (!extension_loaded('pdo_pgsql')) {
        throw new RuntimeException('PHP extension pdo_pgsql is not loaded (rebuild Docker image with postgresql-libs)');
    }

    $pdo = getPdoFromEnv();
    $payload = [
        'home' => ['contentHtml' => '', 'title' => ''],
        'info' => ['contentHtml' => '', 'title' => ''],
    ];

    try {
        $stmt = $pdo->query(publicAppSiteContentSql());
        $rows = $stmt->fetchAll();
        foreach ($rows as $row) {
            $key = (string) ($row['card_key'] ?? '');
            if ($key !== 'home' && $key !== 'info') {
                continue;
            }
            $sanitized = publicClubdeskSanitizeHtml((string) ($row['content'] ?? ''));
            $meta = $row['meta'] ?? null;
            if (is_string($meta)) {
                $decoded = json_decode($meta, true);
                $meta = is_array($decoded) ? $decoded : [];
            }
            if (!is_array($meta)) {
                $meta = [];
            }
            $title = trim(strip_tags(str_ireplace('&nbsp;', ' ', (string) ($meta['title'] ?? ''))));
            if (mb_strlen($title) > 255) {
                $title = mb_substr($title, 0, 255);
            }
            $payload[$key] = [
                'contentHtml' => publicClubdeskIsBlankHtml($sanitized) ? '' : $sanitized,
                'title' => $title,
            ];
        }
    } catch (Throwable $e) {
        // Table may not exist yet on older tenants — return empty cards.
        if (str_contains($e->getMessage(), 'clubdesk_site_content') === false) {
            throw $e;
        }
    }

    if ($cacheEnabled) {
        apcu_store($cacheKey, $payload, $cacheTtl);
    }

    respond(200, $payload);
} catch (Throwable $e) {
    $debug = filter_var(getenv('APP_DEBUG_ERRORS') ?: '0', FILTER_VALIDATE_BOOLEAN);
    if ($debug) {
        respond(500, ['error' => 'Failed to fetch site content', 'details' => $e->getMessage()]);
    }
    respond(500, ['error' => 'Failed to fetch site content']);
}

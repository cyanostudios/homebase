<?php

declare(strict_types=1);

require_once __DIR__ . '/pdo_env.php';
require_once __DIR__ . '/db_helpers.php';
require_once __DIR__ . '/security_headers.php';
require_once __DIR__ . '/cors.php';

/**
 * Public Clubdesk price lists API (PHP + PDO + Postgres/Neon).
 * Published rows only; whitelisted JSON fields.
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

function transformPriceList(array $row): array
{
    $itemCount = (int) ($row['item_count'] ?? 0);
    $description = $row['description'] ?? null;
    $meta = $itemCount === 1 ? '1 produkt' : ($itemCount > 0 ? $itemCount . ' produkter' : null);
    $currency = trim((string) ($row['currency'] ?? 'SEK')) ?: 'SEK';

    return [
        'id' => (string) ($row['id'] ?? ''),
        'name' => $row['name'] ?? '',
        'title' => $row['name'] ?? '',
        'slug' => $row['slug'] ?? null,
        'description' => $description,
        'currency' => $currency,
        'item_count' => $itemCount,
        'meta' => $meta ?? (is_string($description) ? $description : null),
        'updated_at' => $row['updated_at'] ?? null,
        'visible' => true,
    ];
}

try {
    $cacheTtl = (int) (getenv('APP_CACHE_TTL') ?: 0);
    $cacheEnabled = $cacheTtl > 0 && function_exists('apcu_fetch') && filter_var(ini_get('apc.enabled'), FILTER_VALIDATE_BOOLEAN);
    $cacheKey = 'public_clubdesk_price_lists_v1';

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
    $stmt = $pdo->query(publicAppPriceListsSql());
    $rows = $stmt->fetchAll();
    $priceLists = array_map('transformPriceList', $rows);

    $payload = ['priceLists' => $priceLists];

    if ($cacheEnabled) {
        apcu_store($cacheKey, $payload, $cacheTtl);
    }

    respond(200, $payload);
} catch (Throwable $e) {
    $debug = filter_var(getenv('APP_DEBUG_ERRORS') ?: '0', FILTER_VALIDATE_BOOLEAN);
    if ($debug) {
        respond(500, ['error' => 'Failed to fetch price lists', 'details' => $e->getMessage()]);
    }
    respond(500, ['error' => 'Failed to fetch price lists']);
}

<?php

declare(strict_types=1);

require_once __DIR__ . '/pdo_env.php';
require_once __DIR__ . '/db_helpers.php';
require_once __DIR__ . '/security_headers.php';
require_once __DIR__ . '/cors.php';

/**
 * Public items list API (PHP + PDO + Postgres/Neon).
 * - Reads only visible rows
 * - Returns whitelisted JSON fields
 * - Optional APCu cache via APP_CACHE_TTL
 *
 * Rename this file / response key when copying (items.php → cups.php, "items" → "cups").
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

function transformItem(array $row): array
{
    return [
        'id' => (string) ($row['id'] ?? ''),
        'name' => $row['name'] ?? '',
        'slug' => $row['slug'] ?? null,
        'description' => $row['description'] ?? null,
        'featured_image_url' => $row['featured_image_url'] ?? null,
        'category' => $row['category'] ?? null,
        'updated_at' => $row['updated_at'] ?? null,
        'visible' => true,
    ];
}

try {
    $cacheTtl = (int) (getenv('APP_CACHE_TTL') ?: 0);
    $cacheEnabled = $cacheTtl > 0 && function_exists('apcu_fetch') && filter_var(ini_get('apc.enabled'), FILTER_VALIDATE_BOOLEAN);
    $cacheKey = 'public_app_items_v2';

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
    $stmt = $pdo->query(publicAppListSql($pdo));
    $rows = $stmt->fetchAll();
    $items = array_map('transformItem', $rows);

    // categoryOrder is optional; stub returns [] until a catalog is wired (see publicAppCategoryOrder).
    $categoryOrder = publicAppCategoryOrder($pdo);
    $payload = ['items' => $items, 'categoryOrder' => $categoryOrder];

    if ($cacheEnabled) {
        apcu_store($cacheKey, $payload, $cacheTtl);
    }

    respond(200, $payload);
} catch (Throwable $e) {
    $debug = filter_var(getenv('APP_DEBUG_ERRORS') ?: '0', FILTER_VALIDATE_BOOLEAN);
    if ($debug) {
        respond(500, ['error' => 'Failed to fetch items', 'details' => $e->getMessage()]);
    }
    respond(500, ['error' => 'Failed to fetch items']);
}

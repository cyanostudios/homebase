<?php

declare(strict_types=1);

require_once __DIR__ . '/pdo_env.php';
require_once __DIR__ . '/db_helpers.php';
require_once __DIR__ . '/security_headers.php';
require_once __DIR__ . '/cors.php';

/**
 * Public Clubdesk inventory list API (PHP + PDO + Postgres/Neon).
 * Published rows only; omits purchase_price and comment.
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

function inventoryListVariants(array $row): array
{
    $raw = $row['variants'] ?? [];
    if (is_string($raw)) {
        $decoded = json_decode($raw, true);
        $raw = is_array($decoded) ? $decoded : [];
    }
    if (!is_array($raw)) {
        return [];
    }
    $out = [];
    foreach ($raw as $variant) {
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
        ];
    }

    return $out;
}

function inventoryListMeta(array $row): ?string
{
    $parts = [];
    foreach (['brand', 'category', 'package_size', 'material'] as $key) {
        $value = trim((string) ($row[$key] ?? ''));
        if ($value !== '') {
            $parts[] = $value;
        }
    }
    $articleNumber = trim((string) ($row['article_number'] ?? ''));
    if ($articleNumber !== '') {
        $parts[] = 'Art.nr ' . $articleNumber;
    }

    return $parts === [] ? null : implode(' · ', $parts);
}

function transformInventoryListItem(array $row): array
{
    $articleName = $row['article_name'] ?? '';
    $tags = $row['tags'] ?? [];
    if (is_string($tags)) {
        $decoded = json_decode($tags, true);
        $tags = is_array($decoded) ? $decoded : [];
    }
    if (!is_array($tags)) {
        $tags = [];
    }

    $recommended = $row['recommended_price'] ?? null;
    $sale = $row['sale_price'] ?? null;
    $variants = inventoryListVariants($row);
    $description = trim((string) ($row['description'] ?? ''));

    return [
        'id' => (string) ($row['id'] ?? ''),
        'articleName' => $articleName,
        'name' => $articleName,
        'title' => $articleName,
        'brand' => $row['brand'] ?? '',
        'slug' => $row['slug'] ?? null,
        'description' => $description !== '' ? $description : null,
        'material' => $row['material'] ?? '',
        'recommendedPrice' => $recommended !== null && $recommended !== '' ? (float) $recommended : null,
        'salePrice' => $sale !== null && $sale !== '' ? (float) $sale : null,
        'currency' => trim((string) ($row['currency'] ?? 'SEK')) ?: 'SEK',
        'tags' => $tags,
        'category' => trim((string) ($row['category'] ?? '')),
        'articleNumber' => trim((string) ($row['article_number'] ?? '')),
        'packageSize' => trim((string) ($row['package_size'] ?? '')),
        'featuredImageUrl' => $row['featured_image_url'] ?? null,
        'featured' => false,
        'variantCount' => count($variants),
        'variants' => $variants,
        'meta' => inventoryListMeta($row),
        'updated_at' => $row['updated_at'] ?? null,
        'updatedAt' => $row['updated_at'] ?? null,
        'visible' => true,
    ];
}

try {
    $cacheTtl = (int) (getenv('APP_CACHE_TTL') ?: 0);
    $cacheEnabled = $cacheTtl > 0 && function_exists('apcu_fetch') && filter_var(ini_get('apc.enabled'), FILTER_VALIDATE_BOOLEAN);
    $cacheKey = 'public_clubdesk_inventory_v1';

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
    if (!publicAppCardVisible($pdo, 'inventory')) {
        $payload = ['inventory' => [], 'visible' => false];
        if ($cacheEnabled) {
            apcu_store($cacheKey, $payload, $cacheTtl);
        }
        respond(200, $payload);
    }

    $stmt = $pdo->query(publicAppInventorySql($pdo));
    $rows = $stmt->fetchAll();
    $inventory = array_map('transformInventoryListItem', $rows);

    $payload = ['inventory' => $inventory, 'visible' => true];

    if ($cacheEnabled) {
        apcu_store($cacheKey, $payload, $cacheTtl);
    }

    respond(200, $payload);
} catch (Throwable $e) {
    $debug = filter_var(getenv('APP_DEBUG_ERRORS') ?: '0', FILTER_VALIDATE_BOOLEAN);
    if ($debug) {
        respond(500, ['error' => 'Failed to fetch inventory', 'details' => $e->getMessage()]);
    }
    respond(500, ['error' => 'Failed to fetch inventory']);
}

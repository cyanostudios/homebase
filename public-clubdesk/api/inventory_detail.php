<?php

declare(strict_types=1);

require_once __DIR__ . '/pdo_env.php';
require_once __DIR__ . '/db_helpers.php';
require_once __DIR__ . '/security_headers.php';
require_once __DIR__ . '/cors.php';

/**
 * Public Clubdesk inventory detail by slug or id.
 * Published only; omits purchase_price and comment.
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

$slugOrId = isset($_GET['slug']) ? trim((string) $_GET['slug']) : '';
if ($slugOrId === '' && isset($_GET['id'])) {
    $slugOrId = trim((string) $_GET['id']);
}
if ($slugOrId === '') {
    respond(400, ['error' => 'slug or id is required']);
}

try {
    if (!extension_loaded('pdo_pgsql')) {
        throw new RuntimeException('PHP extension pdo_pgsql is not loaded');
    }

    $pdo = getPdoFromEnv();
    $query = publicAppInventoryBySlugSql($pdo, $slugOrId);
    $stmt = $pdo->prepare($query['sql']);
    $stmt->execute($query['params']);
    $row = $stmt->fetch();

    if (!$row) {
        respond(404, ['error' => 'Inventory item not found']);
    }

    $tags = $row['tags'] ?? [];
    if (is_string($tags)) {
        $decoded = json_decode($tags, true);
        $tags = is_array($decoded) ? $decoded : [];
    }
    if (!is_array($tags)) {
        $tags = [];
    }

    $variantsRaw = $row['variants'] ?? '[]';
    if (is_string($variantsRaw)) {
        $variantsDecoded = json_decode($variantsRaw, true);
        $variants = is_array($variantsDecoded) ? $variantsDecoded : [];
    } else {
        $variants = is_array($variantsRaw) ? $variantsRaw : [];
    }

    $recommended = $row['recommended_price'] ?? null;
    $sale = $row['sale_price'] ?? null;
    $articleName = $row['article_name'] ?? '';

    respond(200, [
        'id' => (string) ($row['id'] ?? ''),
        'articleName' => $articleName,
        'name' => $articleName,
        'title' => $articleName,
        'brand' => $row['brand'] ?? '',
        'slug' => $row['slug'] ?? null,
        'description' => $row['description'] ?? null,
        'material' => $row['material'] ?? '',
        'category' => $row['category'] ?? '',
        'packageSize' => $row['package_size'] ?? '',
        'packageUnit' => $row['package_unit'] ?? '',
        'gtin' => $row['gtin'] ?? '',
        'articleNumber' => $row['article_number'] ?? '',
        'ingredients' => $row['ingredients'] ?? null,
        'allergens' => $row['allergens'] ?? null,
        'energyKcal100g' => isset($row['energy_kcal_100g']) && $row['energy_kcal_100g'] !== '' ? (float) $row['energy_kcal_100g'] : null,
        'fatG100g' => isset($row['fat_g_100g']) && $row['fat_g_100g'] !== '' ? (float) $row['fat_g_100g'] : null,
        'saturatedFatG100g' => isset($row['saturated_fat_g_100g']) && $row['saturated_fat_g_100g'] !== '' ? (float) $row['saturated_fat_g_100g'] : null,
        'carbohydrateG100g' => isset($row['carbohydrate_g_100g']) && $row['carbohydrate_g_100g'] !== '' ? (float) $row['carbohydrate_g_100g'] : null,
        'sugarG100g' => isset($row['sugar_g_100g']) && $row['sugar_g_100g'] !== '' ? (float) $row['sugar_g_100g'] : null,
        'proteinG100g' => isset($row['protein_g_100g']) && $row['protein_g_100g'] !== '' ? (float) $row['protein_g_100g'] : null,
        'saltG100g' => isset($row['salt_g_100g']) && $row['salt_g_100g'] !== '' ? (float) $row['salt_g_100g'] : null,
        'netContent' => $row['net_content'] ?? '',
        'countryOfOrigin' => $row['country_of_origin'] ?? '',
        'countryOfManufacture' => $row['country_of_manufacture'] ?? '',
        'supplier' => $row['supplier'] ?? '',
        'recommendedPrice' => $recommended !== null && $recommended !== '' ? (float) $recommended : null,
        'salePrice' => $sale !== null && $sale !== '' ? (float) $sale : null,
        'currency' => trim((string) ($row['currency'] ?? 'SEK')) ?: 'SEK',
        'tags' => $tags,
        'featuredImageUrl' => $row['featured_image_url'] ?? null,
        'featured' => false,
        'variantCount' => count($variants),
        'variants' => $variants,
        'updatedAt' => $row['updated_at'] ?? null,
        'updated_at' => $row['updated_at'] ?? null,
    ]);
} catch (Throwable $e) {
    $debug = filter_var(getenv('APP_DEBUG_ERRORS') ?: '0', FILTER_VALIDATE_BOOLEAN);
    if ($debug) {
        respond(500, ['error' => 'Failed to fetch inventory item', 'details' => $e->getMessage()]);
    }
    respond(500, ['error' => 'Failed to fetch inventory item']);
}

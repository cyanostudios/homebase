<?php

declare(strict_types=1);

require_once __DIR__ . '/pdo_env.php';
require_once __DIR__ . '/db_helpers.php';
require_once __DIR__ . '/security_headers.php';
require_once __DIR__ . '/cors.php';

/**
 * Public single-guide JSON (optional). SSR detail usually uses guide.php.
 * GET /api/item_detail.php?slug=my-slug
 */

applyPublicAppSecurityHeaders('json');
header('Content-Type: application/json; charset=utf-8');

function respondDetail(int $statusCode, array $payload): void
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
    respondDetail(405, ['error' => 'Method not allowed']);
}

$slug = trim((string) ($_GET['slug'] ?? $_GET['id'] ?? ''));
if ($slug === '') {
    respondDetail(400, ['error' => 'Missing slug or id']);
}

try {
    if (!extension_loaded('pdo_pgsql')) {
        throw new RuntimeException('PHP extension pdo_pgsql is not loaded');
    }

    $pdo = getPdoFromEnv();
    $q = publicAppItemBySlugSql($pdo, $slug);
    $stmt = $pdo->prepare($q['sql']);
    $stmt->execute($q['params']);
    $row = $stmt->fetch();
    if (!$row) {
        respondDetail(404, ['error' => 'Guide not found']);
    }

    $stepsRaw = $row['steps'] ?? '[]';
    if (is_string($stepsRaw)) {
        $steps = json_decode($stepsRaw, true);
        if (!is_array($steps)) {
            $steps = [];
        }
    } else {
        $steps = is_array($stepsRaw) ? $stepsRaw : [];
    }

    respondDetail(200, [
        'id' => (string) ($row['id'] ?? ''),
        'name' => $row['name'] ?? '',
        'slug' => $row['slug'] ?? null,
        'description' => $row['description'] ?? null,
        'featured_image_url' => $row['featured_image_url'] ?? null,
        'category' => $row['category'] ?? null,
        'updated_at' => $row['updated_at'] ?? null,
        'steps' => $steps,
    ]);
} catch (Throwable $e) {
    $debug = filter_var(getenv('APP_DEBUG_ERRORS') ?: '0', FILTER_VALIDATE_BOOLEAN);
    if ($debug) {
        respondDetail(500, ['error' => 'Failed to fetch guide', 'details' => $e->getMessage()]);
    }
    respondDetail(500, ['error' => 'Failed to fetch guide']);
}

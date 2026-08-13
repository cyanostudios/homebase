<?php

declare(strict_types=1);

require_once __DIR__ . '/pdo_env.php';
require_once __DIR__ . '/security_headers.php';

/**
 * Public fallback cover images for Cupappen listing/detail when a cup has no featured_image_url.
 * Reads tenant cups_site_config (key fallback_images). Empty → client/SSR use static assets/fallback.
 */

applyPublicCupsSecurityHeaders('json');
header('Content-Type: application/json; charset=utf-8');

function respondFallback(int $statusCode, array $payload): void
{
    http_response_code($statusCode);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function getAllowedOriginsFallback(): array
{
    $raw = getenv('CUPS_ALLOWED_ORIGINS') ?: '';
    if ($raw === '') {
        return [];
    }
    $parts = array_map('trim', explode(',', $raw));

    return array_values(array_filter($parts, static fn ($v) => $v !== ''));
}

function applyCorsFallback(): void
{
    $allowedOrigins = getAllowedOriginsFallback();
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';

    if ($origin !== '' && in_array($origin, $allowedOrigins, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
        header('Access-Control-Allow-Methods: GET, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type');
    }
}

applyCorsFallback();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    respondFallback(405, ['error' => 'Method not allowed']);
}

/**
 * @param mixed $value
 * @return list<string>
 */
function normalizePublicFallbackUrls($value): array
{
    $rawList = [];
    if (is_array($value)) {
        if (array_is_list($value)) {
            $rawList = $value;
        } elseif (isset($value['urls']) && is_array($value['urls'])) {
            $rawList = $value['urls'];
        }
    }
    $out = [];
    $seen = [];
    foreach ($rawList as $item) {
        $url = trim((string) $item);
        if ($url === '') {
            continue;
        }
        if (!preg_match('#^https?://#i', $url)) {
            continue;
        }
        if (preg_match('#^https?://[^/]+/api/#i', $url)) {
            continue;
        }
        if (isset($seen[$url])) {
            continue;
        }
        $seen[$url] = true;
        $out[] = $url;
        if (count($out) >= 100) {
            break;
        }
    }

    return $out;
}

try {
    if (!extension_loaded('pdo_pgsql')) {
        throw new RuntimeException('PHP extension pdo_pgsql is not loaded');
    }

    $pdo = getPdoFromEnv();

    $hasTable = false;
    try {
        $check = $pdo->query(
            "SELECT 1 FROM information_schema.tables
             WHERE table_schema = current_schema()
               AND table_name = 'cups_site_config'
             LIMIT 1",
        );
        $hasTable = (bool) $check->fetchColumn();
    } catch (Throwable $e) {
        $hasTable = false;
    }

    $urls = [];
    if ($hasTable) {
        $ownerId = trim((string) (getenv('PUBLIC_CUPS_USER_ID') ?: ''));
        if ($ownerId !== '' && ctype_digit($ownerId)) {
            $stmt = $pdo->prepare(
                "SELECT value FROM cups_site_config
                  WHERE user_id = :uid AND config_key = 'fallback_images'
                  LIMIT 1",
            );
            $stmt->execute(['uid' => (int) $ownerId]);
        } else {
            $stmt = $pdo->query(
                "SELECT value FROM cups_site_config
                  WHERE config_key = 'fallback_images'
                  ORDER BY updated_at DESC
                  LIMIT 1",
            );
        }
        $row = $stmt ? $stmt->fetch(PDO::FETCH_ASSOC) : false;
        if (is_array($row)) {
            $raw = $row['value'] ?? null;
            if (is_string($raw)) {
                $decoded = json_decode($raw, true);
                $urls = normalizePublicFallbackUrls($decoded);
            } else {
                $urls = normalizePublicFallbackUrls($raw);
            }
        }
    }

    respondFallback(200, ['urls' => $urls]);
} catch (Throwable $e) {
    $debug = filter_var(getenv('CUPS_DEBUG_ERRORS') ?: '0', FILTER_VALIDATE_BOOLEAN);
    if ($debug) {
        respondFallback(500, ['error' => $e->getMessage()]);
    }
    // Soft-fail: SPA/SSR keep static defaults.
    respondFallback(200, ['urls' => []]);
}

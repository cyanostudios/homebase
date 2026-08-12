<?php
declare(strict_types=1);

require_once __DIR__ . '/pdo_env.php';
require_once __DIR__ . '/security_headers.php';
require_once __DIR__ . '/referrer_classify.php';

applyPublicCupsSecurityHeaders('json');
header('Content-Type: application/json; charset=utf-8');

function respond(int $statusCode, ?array $payload = null): void
{
    http_response_code($statusCode);
    if ($payload !== null) {
        echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
    exit;
}

function getAllowedOrigins(): array
{
    $raw = getenv('CUPS_ALLOWED_ORIGINS') ?: '';
    if ($raw === '') {
        return [];
    }
    return array_values(array_filter(array_map('trim', explode(',', $raw))));
}

function applyCors(): void
{
    $allowedOrigins = getAllowedOrigins();
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '' && in_array($origin, $allowedOrigins, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
        header('Access-Control-Allow-Methods: POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type');
    }
}

/** Remove stale cooldown timestamps so PHP session payloads do not grow without bound. */
function prunePageviewCooldownMap(int $cooldownSeconds): void
{
    if (!isset($_SESSION['cupappen_pageview_cooldown']) || !is_array($_SESSION['cupappen_pageview_cooldown'])) {
        return;
    }
    $now = time();
    foreach ($_SESSION['cupappen_pageview_cooldown'] as $key => $ts) {
        $t = (int) $ts;
        if ($t <= 0 || ($now - $t) >= $cooldownSeconds) {
            unset($_SESSION['cupappen_pageview_cooldown'][$key]);
        }
    }
}

applyCors();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, ['error' => 'Method not allowed']);
}

try {
    $pdo = getPdoFromEnv();

    $rawBody = file_get_contents('php://input');
    $payload = json_decode($rawBody ?: '{}', true);
    if (!is_array($payload)) {
        respond(400, ['error' => 'Invalid JSON body']);
    }

    // Never trust client-supplied bucket / domain (Security S4).
    unset($payload['source_bucket'], $payload['referrer_domain'], $payload['bucket']);

    $pageKind = trim((string) ($payload['page_kind'] ?? ''));
    if ($pageKind !== 'cup' && $pageKind !== 'district') {
        respond(400, ['error' => 'page_kind must be cup or district']);
    }

    $targetKey = '';
    if ($pageKind === 'cup') {
        $cupId = (int) ($payload['cup_id'] ?? 0);
        if ($cupId < 1) {
            respond(400, ['error' => 'cup_id is required']);
        }
        $cupStmt = $pdo->prepare(
            'SELECT id FROM cups WHERE id = :id AND COALESCE(visible, TRUE) = TRUE AND deleted_at IS NULL LIMIT 1',
        );
        $cupStmt->execute(['id' => $cupId]);
        if (!$cupStmt->fetch()) {
            respond(404, ['error' => 'Cup not found']);
        }
        $targetKey = (string) $cupId;
    } else {
        $slug = strtolower(trim((string) ($payload['district_slug'] ?? '')));
        if ($slug === '' || !preg_match('/^[a-z0-9-]{1,64}$/', $slug)) {
            respond(400, ['error' => 'district_slug is invalid']);
        }
        $targetKey = $slug;
    }

    $referrerRaw = (string) ($payload['referrer'] ?? '');
    if ($referrerRaw === '') {
        $referrerRaw = (string) ($_SERVER['HTTP_REFERER'] ?? '');
    }
    $classified = cupappen_classify_referrer($referrerRaw);
    $sourceBucket = $classified['bucket'];
    $referrerDomain = $classified['referrer_domain'];

    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }
    if (!isset($_SESSION['cupappen_pageview_cooldown']) || !is_array($_SESSION['cupappen_pageview_cooldown'])) {
        $_SESSION['cupappen_pageview_cooldown'] = [];
    }

    $cooldownSeconds = 45;
    prunePageviewCooldownMap($cooldownSeconds);
    $cooldownKey = $pageKind . '|' . $targetKey;
    $now = time();
    $last = (int) ($_SESSION['cupappen_pageview_cooldown'][$cooldownKey] ?? 0);
    if ($last > 0 && ($now - $last) < $cooldownSeconds) {
        respond(429, ['error' => 'Too many requests']);
    }

    $upsert = $pdo->prepare(
        'INSERT INTO cupappen_pageviews_daily
            (day, page_kind, target_key, source_bucket, referrer_domain, views)
         VALUES
            (CURRENT_DATE, :page_kind, :target_key, :source_bucket, :referrer_domain, 1)
         ON CONFLICT (day, page_kind, target_key, source_bucket, referrer_domain)
         DO UPDATE SET views = cupappen_pageviews_daily.views + 1',
    );
    $upsert->execute([
        'page_kind' => $pageKind,
        'target_key' => $targetKey,
        'source_bucket' => $sourceBucket,
        'referrer_domain' => $referrerDomain,
    ]);

    $_SESSION['cupappen_pageview_cooldown'][$cooldownKey] = $now;
    respond(204);
} catch (Throwable $e) {
    $debug = filter_var(getenv('CUPS_DEBUG_ERRORS') ?: '0', FILTER_VALIDATE_BOOLEAN);
    if ($debug) {
        respond(500, ['error' => 'Pageview API failed', 'details' => $e->getMessage()]);
    }
    respond(500, ['error' => 'Pageview API failed']);
}

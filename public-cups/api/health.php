<?php
declare(strict_types=1);

/**
 * Lightweight liveness/readiness probe for Railway/Docker HEALTHCHECK (no APCu/session).
 */
require_once __DIR__ . '/security_headers.php';
applyPublicCupsSecurityHeaders('json');
header('Content-Type: application/json; charset=utf-8');

try {
    require_once __DIR__ . '/pdo_env.php';
    $pdo = getPdoFromEnv();
    $ok = $pdo->query('SELECT 1')->fetchColumn();
    if ($ok === false || $ok === null) {
        throw new RuntimeException('DB ping failed');
    }
    echo json_encode(['status' => 'ok'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (Throwable $e) {
    http_response_code(503);
    echo json_encode(['status' => 'unhealthy'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

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
    $payload = ['status' => 'unhealthy', 'db' => false];
    if (filter_var(getenv('CUPS_DEBUG_ERRORS') ?: '0', FILTER_VALIDATE_BOOLEAN)) {
        $payload['details'] = $e->getMessage();
    }
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

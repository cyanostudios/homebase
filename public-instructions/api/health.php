<?php

declare(strict_types=1);

/**
 * Lightweight liveness/readiness probe for Railway/Docker HEALTHCHECK.
 */
require_once __DIR__ . '/security_headers.php';
applyPublicAppSecurityHeaders('json');
header('Content-Type: application/json; charset=utf-8');

$debug = filter_var(getenv('APP_DEBUG_ERRORS') ?: '0', FILTER_VALIDATE_BOOLEAN);

try {
    if (!extension_loaded('pdo_pgsql')) {
        throw new RuntimeException('pdo_pgsql extension not loaded');
    }

    $hasDbUrl = (getenv('APP_DB_URL') ?: '') !== '' || (getenv('APP_DB_HOST') ?: '') !== '';
    if (!$hasDbUrl && (getenv('DATABASE_URL') ?: '') === '') {
        throw new RuntimeException('Missing APP_DB_URL (or APP_DB_HOST / DATABASE_URL)');
    }

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
    if ($debug) {
        $payload['details'] = $e->getMessage();
    }
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

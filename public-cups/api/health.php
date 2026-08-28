<?php
declare(strict_types=1);

/**
 * Liveness / readiness for Railway & Docker HEALTHCHECK.
 *
 * Default GET (no query): liveness only — PHP + env, no Neon/Postgres ping (avoids
 * thousands of idle tenant-DB queries per month from health probes).
 *
 * GET ?db=1 (or ?deep=1): readiness — includes SELECT 1 against CUPS_DB_URL (use after deploy).
 */
require_once __DIR__ . '/security_headers.php';
applyPublicCupsSecurityHeaders('json');
header('Content-Type: application/json; charset=utf-8');

$debug = filter_var(getenv('CUPS_DEBUG_ERRORS') ?: '0', FILTER_VALIDATE_BOOLEAN);

/** @var array<string, string> */
$query = $_GET ?? [];
$deepCheck = array_key_exists('db', $query) || array_key_exists('deep', $query);

function cupsHealthHasDbConfig(): bool
{
    return (getenv('CUPS_DB_URL') ?: '') !== ''
        || (getenv('CUPS_DB_HOST') ?: '') !== ''
        || (getenv('DATABASE_URL') ?: '') !== '';
}

try {
    if (!extension_loaded('pdo_pgsql')) {
        throw new RuntimeException('pdo_pgsql extension not loaded');
    }

    if (!cupsHealthHasDbConfig()) {
        throw new RuntimeException('Missing CUPS_DB_URL (or CUPS_DB_HOST / DATABASE_URL)');
    }

    if (!$deepCheck) {
        echo json_encode(
            ['status' => 'ok', 'check' => 'live'],
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
        );
        exit;
    }

    require_once __DIR__ . '/pdo_env.php';
    $pdo = getPdoFromEnv();
    $ok = $pdo->query('SELECT 1')->fetchColumn();
    if ($ok === false || $ok === null) {
        throw new RuntimeException('DB ping failed');
    }
    echo json_encode(
        ['status' => 'ok', 'check' => 'db'],
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
    );
} catch (Throwable $e) {
    http_response_code(503);
    $payload = ['status' => 'unhealthy', 'check' => $deepCheck ? 'db' : 'live'];
    if ($deepCheck) {
        $payload['db'] = false;
    }
    if ($debug) {
        $payload['details'] = $e->getMessage();
    }
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

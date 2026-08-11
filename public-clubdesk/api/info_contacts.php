<?php

declare(strict_types=1);

require_once __DIR__ . '/pdo_env.php';
require_once __DIR__ . '/db_helpers.php';
require_once __DIR__ . '/security_headers.php';
require_once __DIR__ . '/cors.php';

/**
 * Public Clubdesk Info contacts API.
 * Presence = published: empty array when none / table missing.
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

function publicInfoContactDisplayName(array $row): string
{
    $company = trim((string) ($row['company_name'] ?? ''));
    if ($company !== '') {
        return $company;
    }
    $persons = $row['contact_persons'] ?? null;
    if (is_string($persons)) {
        $decoded = json_decode($persons, true);
        $persons = is_array($decoded) ? $decoded : [];
    }
    if (is_array($persons) && isset($persons[0]) && is_array($persons[0])) {
        $name = trim((string) ($persons[0]['name'] ?? $persons[0]['fullName'] ?? ''));
        if ($name !== '') {
            return $name;
        }
    }

    return 'Kontakt';
}

function transformInfoContact(array $row): array
{
    $phone = trim((string) ($row['phone'] ?? ''));
    $email = trim((string) ($row['email'] ?? ''));
    $blurb = trim((string) ($row['blurb'] ?? ''));

    return [
        'id' => (string) ($row['id'] ?? ''),
        'name' => publicInfoContactDisplayName($row),
        'phone' => $phone !== '' ? $phone : null,
        'email' => $email !== '' ? $email : null,
        'blurb' => $blurb !== '' ? $blurb : null,
    ];
}

try {
    $cacheTtl = (int) (getenv('APP_CACHE_TTL') ?: 0);
    $cacheEnabled = $cacheTtl > 0 && function_exists('apcu_fetch') && filter_var(ini_get('apc.enabled'), FILTER_VALIDATE_BOOLEAN);
    $cacheKey = 'public_clubdesk_info_contacts_v1';

    if ($cacheEnabled) {
        $cached = apcu_fetch($cacheKey, $ok);
        if ($ok && is_array($cached)) {
            respond(200, $cached);
        }
    }

    if (!extension_loaded('pdo_pgsql')) {
        throw new RuntimeException('PHP extension pdo_pgsql is not loaded');
    }

    $pdo = getPdoFromEnv();
    $sql = publicAppInfoContactsSql($pdo);
    $items = [];
    if ($sql !== null) {
        $stmt = $pdo->query($sql);
        $items = array_map('transformInfoContact', $stmt->fetchAll());
    }

    $payload = ['items' => $items];

    if ($cacheEnabled) {
        apcu_store($cacheKey, $payload, $cacheTtl);
    }

    respond(200, $payload);
} catch (Throwable $e) {
    $debug = filter_var(getenv('APP_DEBUG_ERRORS') ?: '0', FILTER_VALIDATE_BOOLEAN);
    if ($debug) {
        respond(500, ['error' => 'Failed to fetch contacts', 'details' => $e->getMessage()]);
    }
    respond(500, ['error' => 'Failed to fetch contacts']);
}

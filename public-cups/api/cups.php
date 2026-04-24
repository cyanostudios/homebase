<?php
declare(strict_types=1);

/**
 * Public Cups API (PHP + PDO + Postgres/Neon)
 *
 * - Reads only public cups (visible = true)
 * - Returns whitelisted JSON fields
 * - Optional APCu cache via CUPS_CACHE_TTL
 */

header('Content-Type: application/json; charset=utf-8');

/**
 * Send JSON and exit.
 */
function respond(int $statusCode, array $payload): void
{
    http_response_code($statusCode);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/**
 * Resolve allowed origins from env (comma-separated).
 * Example: CUPS_ALLOWED_ORIGINS=https://cupappen.se,https://www.cupappen.se
 */
function getAllowedOrigins(): array
{
    $raw = getenv('CUPS_ALLOWED_ORIGINS') ?: '';
    if ($raw === '') {
        return [];
    }
    $parts = array_map('trim', explode(',', $raw));
    return array_values(array_filter($parts, static fn ($v) => $v !== ''));
}

/**
 * Apply CORS policy.
 */
function applyCors(): void
{
    $allowedOrigins = getAllowedOrigins();
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';

    if ($origin !== '' && in_array($origin, $allowedOrigins, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
        header('Access-Control-Allow-Methods: GET, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type');
    }
}

applyCors();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    respond(405, ['error' => 'Method not allowed']);
}

/**
 * Build PDO DSN from env.
 * Priority:
 *   1) CUPS_DB_URL
 *   2) CUPS_DB_HOST + CUPS_DB_NAME + CUPS_DB_USER + CUPS_DB_PASS (+ optional CUPS_DB_PORT)
 */
function getPdoFromEnv(): PDO
{
    $dbUrl = getenv('CUPS_DB_URL') ?: '';
    if ($dbUrl !== '') {
        $parts = parse_url($dbUrl);
        if ($parts === false || !isset($parts['host'], $parts['path'], $parts['user'])) {
            throw new RuntimeException('Invalid CUPS_DB_URL');
        }

        $host = $parts['host'];
        $port = $parts['port'] ?? 5432;
        $dbName = ltrim($parts['path'], '/');
        $user = $parts['user'];
        $pass = $parts['pass'] ?? '';
        $query = $parts['query'] ?? '';
        parse_str($query, $queryVars);
        $sslmode = $queryVars['sslmode'] ?? 'require';

        $dsn = sprintf(
            'pgsql:host=%s;port=%d;dbname=%s;sslmode=%s',
            $host,
            (int) $port,
            $dbName,
            $sslmode
        );
    } else {
        $host = getenv('CUPS_DB_HOST') ?: '';
        $dbName = getenv('CUPS_DB_NAME') ?: '';
        $user = getenv('CUPS_DB_USER') ?: '';
        $pass = getenv('CUPS_DB_PASS') ?: '';
        $port = (int) (getenv('CUPS_DB_PORT') ?: 5432);
        $sslmode = getenv('CUPS_DB_SSLMODE') ?: 'require';

        if ($host === '' || $dbName === '' || $user === '') {
            throw new RuntimeException('Missing DB env vars (set CUPS_DB_URL or CUPS_DB_*)');
        }

        $dsn = sprintf(
            'pgsql:host=%s;port=%d;dbname=%s;sslmode=%s',
            $host,
            $port,
            $dbName,
            $sslmode
        );
    }

    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::ATTR_TIMEOUT => 8,
    ]);

    return $pdo;
}

/**
 * Normalize value to boolean.
 */
function toBool($value, bool $fallback = false): bool
{
    if (is_bool($value)) {
        return $value;
    }
    if ($value === null) {
        return $fallback;
    }
    if (is_numeric($value)) {
        return ((int) $value) !== 0;
    }
    $lower = strtolower((string) $value);
    if (in_array($lower, ['true', 't', 'yes', 'y', '1'], true)) {
        return true;
    }
    if (in_array($lower, ['false', 'f', 'no', 'n', '0'], true)) {
        return false;
    }
    return $fallback;
}

/**
 * Map database row to whitelist response shape.
 */
function transformCup(array $row): array
{
    $teamCount = null;
    if ($row['team_count'] !== null && $row['team_count'] !== '') {
        $n = (int) $row['team_count'];
        $teamCount = $n > 0 ? $n : null;
    }

    return [
        'id' => (string) ($row['id'] ?? ''),
        'name' => $row['name'] ?? '',
        'organizer' => $row['organizer'] ?? null,
        'location' => $row['location'] ?? null,
        'start_date' => $row['start_date'] ?? null,
        'end_date' => $row['end_date'] ?? null,
        'categories' => $row['categories'] ?? null,
        /** Explicit true: SQL already filters visible; clients treat missing as hidden in some builds. */
        'visible' => true,
        'featured' => toBool($row['featured'] ?? false, false),
        'sanctioned' => toBool($row['sanctioned'] ?? true, true),
        'team_count' => $teamCount,
        'match_format' => $row['match_format'] ?? null,
        'registration_url' => $row['registration_url'] ?? null,
        'featured_image_url' => $row['featured_image_url'] ?? null,
        'description' => $row['description'] ?? null,
        'source_url' => $row['source_url'] ?? null,
        'source_type' => $row['source_type'] ?? null,
        'ingest_source_name' => $row['ingest_source_name'] ?? null,
        'updated_at' => $row['updated_at'] ?? null,
    ];
}

try {
    $cacheTtl = (int) (getenv('CUPS_CACHE_TTL') ?: 0);
    $cacheEnabled = $cacheTtl > 0 && function_exists('apcu_fetch') && filter_var(ini_get('apc.enabled'), FILTER_VALIDATE_BOOLEAN);
    $cacheKey = 'public_cups_v1';

    if ($cacheEnabled) {
        $cached = apcu_fetch($cacheKey, $ok);
        if ($ok && is_array($cached)) {
            respond(200, $cached);
        }
    }

    $pdo = getPdoFromEnv();
    $sql = <<<SQL
SELECT
  c.id,
  c.name,
  c.organizer,
  c.location,
  c.start_date,
  c.end_date,
  c.categories,
  c.featured,
  c.sanctioned,
  c.team_count,
  c.match_format,
  c.registration_url,
  c.featured_image_url,
  c.description,
  c.source_url,
  c.source_type,
  c.updated_at,
  src.name AS ingest_source_name
FROM cups c
LEFT JOIN ingest_sources src ON src.id = c.ingest_source_id
WHERE COALESCE(c.visible, TRUE) = TRUE
ORDER BY c.start_date ASC NULLS LAST, c.name ASC
SQL;

    $stmt = $pdo->query($sql);
    $rows = $stmt->fetchAll();
    $cups = array_map('transformCup', $rows);

    $payload = ['cups' => $cups];

    if ($cacheEnabled) {
        apcu_store($cacheKey, $payload, $cacheTtl);
    }

    respond(200, $payload);
} catch (Throwable $e) {
    $debug = filter_var(getenv('CUPS_DEBUG_ERRORS') ?: '0', FILTER_VALIDATE_BOOLEAN);
    if ($debug) {
        respond(500, ['error' => 'Failed to fetch cups', 'details' => $e->getMessage()]);
    }
    respond(500, ['error' => 'Failed to fetch cups']);
}

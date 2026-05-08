<?php

declare(strict_types=1);

/**
 * Shared PDO connection for public-cups API scripts.
 * Environment: CUPS_DB_URL or CUPS_DB_HOST / CUPS_DB_NAME / CUPS_DB_USER / CUPS_DB_PASS.
 */
function parsePgUrl(string $url): array
{
    $parts = parse_url($url);
    if ($parts === false || !isset($parts['host'], $parts['path'])) {
        throw new RuntimeException('Invalid PostgreSQL URL: ' . $url);
    }
    $host    = $parts['host'];
    $port    = $parts['port'] ?? 5432;
    $dbName  = ltrim($parts['path'], '/');
    $user    = $parts['user'] ?? '';
    $pass    = $parts['pass'] ?? '';
    $query   = $parts['query'] ?? '';
    parse_str($query, $queryVars);
    $sslmode = $queryVars['sslmode'] ?? 'require';

    return compact('host', 'port', 'dbName', 'user', 'pass', 'sslmode');
}

function getPdoFromEnv(): PDO
{
    $cupsUrl = getenv('CUPS_DB_URL') ?: '';
    $cupsHost = getenv('CUPS_DB_HOST') ?: '';

    if ($cupsUrl !== '') {
        $c = parsePgUrl($cupsUrl);
    } elseif ($cupsHost !== '') {
        $c = [
            'host'    => $cupsHost,
            'port'    => (int) (getenv('CUPS_DB_PORT') ?: 5432),
            'dbName'  => getenv('CUPS_DB_NAME') ?: '',
            'user'    => getenv('CUPS_DB_USER') ?: '',
            'pass'    => getenv('CUPS_DB_PASS') ?: '',
            'sslmode' => getenv('CUPS_DB_SSLMODE') ?: 'require',
        ];
        if ($c['dbName'] === '') {
            throw new RuntimeException('Missing CUPS_DB_NAME env var');
        }
    } else {
        // Fall back to the shared DATABASE_URL (useful for local dev)
        $fallback = getenv('DATABASE_URL') ?: '';
        if ($fallback === '') {
            throw new RuntimeException('Missing DB env vars (set CUPS_DB_URL, CUPS_DB_HOST, or DATABASE_URL)');
        }
        $c = parsePgUrl($fallback);
        // Local dev URLs often omit sslmode — disable SSL for loopback connections.
        if ($c['host'] === 'localhost' || $c['host'] === '127.0.0.1') {
            $c['sslmode'] = 'disable';
        }
    }

    $dsn = sprintf(
        'pgsql:host=%s;port=%d;dbname=%s;sslmode=%s',
        $c['host'],
        (int) $c['port'],
        $c['dbName'],
        $c['sslmode'],
    );
    $user = $c['user'];
    $pass = $c['pass'];

    return new PDO($dsn, $user !== '' ? $user : null, $pass !== '' ? $pass : null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::ATTR_TIMEOUT => 8,
    ]);
}

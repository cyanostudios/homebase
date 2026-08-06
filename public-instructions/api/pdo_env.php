<?php

declare(strict_types=1);

/**
 * Shared PDO connection for public-app API scripts.
 * Environment: APP_DB_URL or APP_DB_HOST / APP_DB_NAME / APP_DB_USER / APP_DB_PASS.
 * When copying the template, rename APP_ → your prefix (e.g. CUPS_, GUIDES_).
 */
function parsePgUrl(string $url): array
{
    $parts = parse_url($url);
    if ($parts === false || !isset($parts['host'], $parts['path'])) {
        throw new RuntimeException('Invalid PostgreSQL URL: ' . $url);
    }
    $host = $parts['host'];
    $port = $parts['port'] ?? 5432;
    $dbName = ltrim($parts['path'], '/');
    $user = $parts['user'] ?? '';
    $pass = $parts['pass'] ?? '';
    $query = $parts['query'] ?? '';
    parse_str($query, $queryVars);
    $sslmode = $queryVars['sslmode'] ?? 'require';

    return compact('host', 'port', 'dbName', 'user', 'pass', 'sslmode');
}

function getPdoFromEnv(): PDO
{
    $appUrl = getenv('APP_DB_URL') ?: '';
    $appHost = getenv('APP_DB_HOST') ?: '';

    if ($appUrl !== '') {
        $c = parsePgUrl($appUrl);
    } elseif ($appHost !== '') {
        $c = [
            'host' => $appHost,
            'port' => (int) (getenv('APP_DB_PORT') ?: 5432),
            'dbName' => getenv('APP_DB_NAME') ?: '',
            'user' => getenv('APP_DB_USER') ?: '',
            'pass' => getenv('APP_DB_PASS') ?: '',
            'sslmode' => getenv('APP_DB_SSLMODE') ?: 'require',
        ];
        if ($c['dbName'] === '') {
            throw new RuntimeException('Missing APP_DB_NAME env var');
        }
    } else {
        // Fall back for local PHP -S against a shared DATABASE_URL (dev only).
        $fallback = getenv('DATABASE_URL') ?: '';
        if ($fallback === '') {
            throw new RuntimeException('Missing DB env vars (set APP_DB_URL, APP_DB_HOST, or DATABASE_URL)');
        }
        $c = parsePgUrl($fallback);
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

    return new PDO($dsn, $c['user'] !== '' ? $c['user'] : null, $c['pass'] !== '' ? $c['pass'] : null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::ATTR_TIMEOUT => 8,
    ]);
}

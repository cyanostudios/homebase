<?php

declare(strict_types=1);

/**
 * Shared PDO connection for public-cups API scripts.
 * Environment: CUPS_DB_URL or CUPS_DB_HOST / CUPS_DB_NAME / CUPS_DB_USER / CUPS_DB_PASS.
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

    return new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::ATTR_TIMEOUT => 8,
    ]);
}

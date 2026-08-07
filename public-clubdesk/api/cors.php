<?php

declare(strict_types=1);

/**
 * CORS for public JSON endpoints. Origins from APP_ALLOWED_ORIGINS (comma-separated).
 */
function getAllowedOrigins(): array
{
    $raw = getenv('APP_ALLOWED_ORIGINS') ?: '';
    if ($raw === '') {
        return [];
    }
    $parts = array_map('trim', explode(',', $raw));

    return array_values(array_filter($parts, static fn ($v) => $v !== ''));
}

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

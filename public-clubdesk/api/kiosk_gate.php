<?php

declare(strict_types=1);

/**
 * Staff gate for kiosk stock writes and the internal note.
 * Secret stays in PUBLIC_CLUBDESK_KIOSK_SECRET. The cookie is stateless.
 */

const KIOSK_STAFF_COOKIE = 'clubdesk_kiosk';
const KIOSK_STAFF_TTL_SECONDS = 43200;
const KIOSK_STAFF_SECRET_MIN = 32;

function kioskStaffSecret(): string
{
    return (string) (getenv('PUBLIC_CLUBDESK_KIOSK_SECRET') ?: '');
}

function kioskStaffGateOpen(?string $secret = null): bool
{
    $value = $secret === null ? kioskStaffSecret() : $secret;

    return strlen($value) >= KIOSK_STAFF_SECRET_MIN;
}

function kioskStaffIssueCookie(int $now, string $secret): string
{
    $expiry = $now + KIOSK_STAFF_TTL_SECONDS;

    return $expiry . '.' . hash_hmac('sha256', (string) $expiry, $secret);
}

function kioskStaffCookieValid(?string $cookie, string $secret, int $now): bool
{
    if (!kioskStaffGateOpen($secret) || $cookie === null || $cookie === '') {
        return false;
    }
    $parts = explode('.', $cookie, 2);
    if (count($parts) !== 2) {
        return false;
    }
    [$expiryRaw, $hmac] = $parts;
    if (!preg_match('/^[0-9]{1,12}$/', $expiryRaw) || !preg_match('/^[a-f0-9]{64}$/', $hmac)) {
        return false;
    }
    $expiry = (int) $expiryRaw;
    if ($expiry <= $now || $expiry > $now + KIOSK_STAFF_TTL_SECONDS) {
        return false;
    }
    $expected = hash_hmac('sha256', (string) $expiry, $secret);

    return hash_equals($expected, $hmac);
}

function kioskRequestHost(): string
{
    $host = strtolower(trim((string) ($_SERVER['HTTP_HOST'] ?? '')));
    $host = preg_replace('/:\d+$/', '', $host) ?? '';

    return $host;
}

function kioskSameOriginAllowed(): bool
{
    $origin = trim((string) ($_SERVER['HTTP_ORIGIN'] ?? ''));
    $referer = trim((string) ($_SERVER['HTTP_REFERER'] ?? ''));
    $source = $origin !== '' ? $origin : $referer;
    if ($source === '') {
        return false;
    }
    $sourceHost = strtolower((string) parse_url($source, PHP_URL_HOST));

    return $sourceHost !== '' && $sourceHost === kioskRequestHost();
}

function kioskRequestIsHttps(): bool
{
    $https = strtolower((string) ($_SERVER['HTTPS'] ?? ''));
    if ($https !== '' && $https !== 'off') {
        return true;
    }
    $proto = strtolower(trim((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')));

    return $proto === 'https';
}

function kioskStaffSetCookie(string $value, int $expiry): void
{
    setcookie(KIOSK_STAFF_COOKIE, $value, [
        'expires' => $expiry,
        'path' => '/',
        'secure' => kioskRequestIsHttps(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

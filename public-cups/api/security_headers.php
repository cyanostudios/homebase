<?php

declare(strict_types=1);

/**
 * Bas-headers för publika public-cups PHP-svar (defence in depth).
 * Anropas innan body skickas.
 *
 * @param 'json'|'xml' $responseType styr CSP (minimal för API/XML utan HTML).
 */
function applyPublicCupsSecurityHeaders(string $responseType = 'json'): void
{
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header(
        'Permissions-Policy: accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()',
    );

    if ($responseType === 'json' || $responseType === 'xml') {
        header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");
    }
}

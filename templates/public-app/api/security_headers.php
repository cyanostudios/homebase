<?php

declare(strict_types=1);

/**
 * Security headers for all public-app responses.
 *
 * @param 'html'|'json'|'xml' $responseType
 */
function applyPublicAppSecurityHeaders(string $responseType = 'json'): void
{
    header_remove('X-Powered-By');

    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('Permissions-Policy: accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()');

    if ($responseType === 'html') {
        header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
        header('X-Frame-Options: SAMEORIGIN');
        header(
            "Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none';" .
            " script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://tagmanager.google.com;" .
            " style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;" .
            " font-src 'self' https://fonts.gstatic.com data:;" .
            " img-src 'self' data: https:;" .
            " connect-src 'self' https:;" .
            " frame-src https://www.googletagmanager.com;" .
            " form-action 'self';" .
            " upgrade-insecure-requests"
        );
    } else {
        header('X-Frame-Options: DENY');
        header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");
    }
}

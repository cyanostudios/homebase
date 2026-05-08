<?php

declare(strict_types=1);

/**
 * Security headers for all public-cups responses.
 *
 * @param 'html'|'json'|'xml' $responseType
 */
function applyPublicCupsSecurityHeaders(string $responseType = 'json'): void
{
    // Remove PHP version disclosure.
    header_remove('X-Powered-By');

    // Universal headers (all response types).
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('Permissions-Policy: accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()');

    if ($responseType === 'html') {
        // HSTS: tell browsers to always use HTTPS (1 year).
        header('Strict-Transport-Security: max-age=31536000; includeSubDomains');

        // Framing: allow same-origin only (protects against clickjacking).
        header('X-Frame-Options: SAMEORIGIN');

        // Full CSP for HTML pages.
        // - script-src: self + inline (GTM requires it) + GTM/GA domains.
        // - style-src:  self + inline (used throughout) + Google Fonts.
        // - font-src:   self + gstatic + data: (font face fallbacks).
        // - img-src:    self + data: + https: (R2 images, Pexels, OG images).
        // - connect-src: self + https: (API calls, analytics, etc.).
        // - frame-src:  GTM noscript iframe.
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
        // API / XML: strict no-framing + minimal CSP.
        header('X-Frame-Options: DENY');
        header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");
    }
}

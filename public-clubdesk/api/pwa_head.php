<?php
declare(strict_types=1);

/**
 * Shared PWA head tags for Clubdesk public surfaces.
 * Installable only (no service worker). Theme matches --brand hsl(262 83% 58%).
 */
function publicClubdeskPwaHeadTags(): void
{
    echo <<<'HTML'
    <meta name="theme-color" content="#7c3bed" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="Clubdesk" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" sizes="180x180" />

HTML;
}

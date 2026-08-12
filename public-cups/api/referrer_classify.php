<?php
declare(strict_types=1);

/**
 * Referrer classification for Cupappen pageviews.
 * Keep in sync with public-cups/lib/referrerClassify.js
 */

const CUPAPPEN_MAX_REFERRER_CHARS = 2048;

/**
 * @return array{bucket: string, referrer_domain: string}
 */
function cupappen_classify_referrer(?string $referrer): array
{
    $host = cupappen_extract_referrer_host($referrer);
    if ($host === '') {
        return ['bucket' => 'direct', 'referrer_domain' => ''];
    }

    $bare = cupappen_strip_www($host);
    $domain = substr($bare, 0, 255);

    $internal = ['cupappen.se', 'www.cupappen.se', 'localhost', '127.0.0.1'];
    if (in_array($host, $internal, true) || in_array($bare, $internal, true) || str_ends_with($host, '.cupappen.se')) {
        return ['bucket' => 'internal', 'referrer_domain' => $domain !== '' ? $domain : 'cupappen.se'];
    }

    if (cupappen_is_search_host($host)) {
        return ['bucket' => 'search', 'referrer_domain' => $domain];
    }
    if (cupappen_is_social_host($host)) {
        return ['bucket' => 'social', 'referrer_domain' => $domain];
    }

    return ['bucket' => 'other', 'referrer_domain' => $domain];
}

function cupappen_truncate_referrer(string $raw): string
{
    $s = trim($raw);
    if (strlen($s) <= CUPAPPEN_MAX_REFERRER_CHARS) {
        return $s;
    }
    return substr($s, 0, CUPAPPEN_MAX_REFERRER_CHARS);
}

function cupappen_extract_referrer_host(?string $referrer): string
{
    $raw = cupappen_truncate_referrer((string) ($referrer ?? ''));
    if ($raw === '') {
        return '';
    }
    if (!preg_match('/^[a-zA-Z][a-zA-Z0-9+.-]*:/', $raw)) {
        $raw = 'https://' . $raw;
    }
    $parts = parse_url($raw);
    if (!is_array($parts) || empty($parts['host'])) {
        return '';
    }
    return strtolower(trim((string) $parts['host']));
}

function cupappen_strip_www(string $host): string
{
    return str_starts_with($host, 'www.') ? substr($host, 4) : $host;
}

function cupappen_host_matches_base(string $host, string $base): bool
{
    return $host === $base || str_ends_with($host, '.' . $base);
}

function cupappen_is_search_host(string $host): bool
{
    foreach (['google.', 'bing.', 'duckduckgo.', 'yahoo.', 'ecosia.', 'brave.'] as $marker) {
        if (str_contains($host, $marker)) {
            return true;
        }
    }
    return false;
}

function cupappen_is_social_host(string $host): bool
{
    $bare = cupappen_strip_www($host);
    $bases = [
        'facebook.com',
        'fb.com',
        'instagram.com',
        'twitter.com',
        'x.com',
        't.co',
        'linkedin.com',
        'tiktok.com',
        'youtube.com',
        'youtu.be',
    ];
    foreach ($bases as $base) {
        if (cupappen_host_matches_base($bare, $base) || cupappen_host_matches_base($host, $base)) {
            return true;
        }
    }
    return false;
}

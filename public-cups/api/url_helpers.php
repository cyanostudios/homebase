<?php

declare(strict_types=1);

/**
 * Append utm_source=cupappen on outbound URLs (registration, JSON-LD offers).
 * Mirrors public-cups/lib/utm.js withCupappenUtm().
 *
 * Decodes HTML entities first so stored `&amp;` does not become `amp;lang=…`
 * via parse_str / URLSearchParams (breaks Procup/Cupmate query strings).
 */
function withCupappenUtm(string $urlValue): string
{
    $raw = trim(html_entity_decode($urlValue, ENT_QUOTES | ENT_HTML5, 'UTF-8'));
    if ($raw === '') {
        return '';
    }

    $hash = '';
    $hashPos = strpos($raw, '#');
    if ($hashPos !== false) {
        $hash = substr($raw, $hashPos);
        $raw = substr($raw, 0, $hashPos);
    }

    if (preg_match('/[?&]utm_source=/i', $raw)) {
        $out = preg_replace('/([?&])utm_source=[^&]*/i', '$1utm_source=cupappen', $raw) ?? $raw;

        return str_replace('?&', '?', $out) . $hash;
    }

    $sep = str_contains($raw, '?') ? '&' : '?';

    return $raw . $sep . 'utm_source=cupappen' . $hash;
}
